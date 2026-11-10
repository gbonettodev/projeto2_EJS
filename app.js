import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './db.js';
import { verificarAutenticacao } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'chave-local-de-desenvolvimento-troque-no-env',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 },
}));

app.get('/', (req, res) => res.redirect(req.session.usuario ? '/produtos' : '/login'));

app.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/produtos');
  res.render('login', { erro: null, email: '' });
});

app.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  try {
    const resultado = await pool.query(
      'SELECT id, nome, email, senha FROM usuarios WHERE email = $1',
      [email],
    );
    const usuario = resultado.rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).render('login', {
        erro: 'E-mail ou senha não conferem. Confira os dados e tente novamente.', email,
      });
    }
    req.session.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email };
    return req.session.save((error) => {
      if (error) {
        console.error('Não foi possível iniciar a sessão:', error.message);
        return res.status(500).render('login', { erro: 'Não foi possível iniciar a sessão.', email });
      }
      res.redirect('/produtos');
    });
  } catch (error) {
    console.error('Erro ao realizar login:', error.message);
    return res.status(500).render('login', {
      erro: 'Não foi possível conectar ao PostgreSQL. Confira a configuração do banco.', email,
    });
  }
});

// O guia usa GET para encerrar a sessão.
app.get('/logout', verificarAutenticacao, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.get('/grupos', verificarAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM grupos ORDER BY id ASC');
    res.render('grupos', { grupos: resultado.rows, usuario: req.session.usuario, erro: null });
  } catch (error) {
    console.error('Erro ao buscar grupos:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar os grupos.' });
  }
});

app.post('/grupos/novo', verificarAutenticacao, async (req, res) => {
  const descricao = String(req.body.descricao_grupo || '').trim();
  if (!descricao || descricao.length > 100) {
    const grupos = await pool.query('SELECT * FROM grupos ORDER BY id ASC');
    return res.status(400).render('grupos', {
      grupos: grupos.rows, usuario: req.session.usuario,
      erro: 'Informe uma descrição de grupo com até 100 caracteres.',
    });
  }
  try {
    await pool.query('INSERT INTO grupos (descricao_grupo) VALUES ($1)', [descricao]);
    res.redirect('/grupos');
  } catch (error) {
    console.error('Erro ao cadastrar grupo:', error.message);
    const grupos = await pool.query('SELECT * FROM grupos ORDER BY id ASC');
    res.status(500).render('grupos', {
      grupos: grupos.rows, usuario: req.session.usuario,
      erro: 'Não foi possível cadastrar o grupo.',
    });
  }
});

// ON DELETE SET NULL preserva os produtos ligados ao grupo removido.
app.get('/grupos/deletar/:id', verificarAutenticacao, async (req, res) => {
  try {
    await pool.query('DELETE FROM grupos WHERE id = $1', [req.params.id]);
    res.redirect('/grupos');
  } catch (error) {
    console.error('Erro ao excluir grupo:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível excluir este grupo.' });
  }
});

app.get('/produtos', verificarAutenticacao, async (req, res) => {
  const busca = String(req.query.busca || '').trim();
  try {
    const resultado = await pool.query(
      `SELECT p.id, p.nome_produto, p.peso, p.preco, p.grupo_id,
              g.descricao_grupo
       FROM produtos p
       LEFT JOIN grupos g ON p.grupo_id = g.id
       WHERE p.nome_produto ILIKE $1 OR COALESCE(g.descricao_grupo, '') ILIKE $1
       ORDER BY p.id DESC`,
      [`%${busca}%`],
    );
    res.render('produtos', {
      produtos: resultado.rows, usuario: req.session.usuario, busca, erro: null,
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar os produtos.' });
  }
});

app.get('/produtos/novo', verificarAutenticacao, async (req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM grupos ORDER BY descricao_grupo ASC');
    res.render('novo-produto', {
      grupos: resultado.rows, usuario: req.session.usuario, erro: null,
      produto: { nome_produto: '', peso: '', preco: '', grupo_id: '' },
    });
  } catch (error) {
    console.error('Erro ao carregar grupos:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar o formulário.' });
  }
});

app.post('/produtos/novo', verificarAutenticacao, async (req, res) => {
  const produto = lerProduto(req.body);
  const erro = validarProduto(produto);
  if (erro) return renderNovoProduto(res, req, produto, erro, 400);
  try {
    await pool.query(
      'INSERT INTO produtos (nome_produto, peso, preco, grupo_id) VALUES ($1, $2, $3, $4)',
      [produto.nome_produto, produto.peso, produto.preco, produto.grupo_id],
    );
    res.redirect('/produtos');
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error.message);
    renderNovoProduto(res, req, produto, 'Não foi possível salvar o produto.', 500);
  }
});

app.get('/produtos/editar/:id', verificarAutenticacao, async (req, res) => {
  try {
    const [produtoRes, gruposRes] = await Promise.all([
      pool.query('SELECT * FROM produtos WHERE id = $1', [req.params.id]),
      pool.query('SELECT * FROM grupos ORDER BY descricao_grupo ASC'),
    ]);
    if (produtoRes.rowCount === 0) return res.status(404).render('404');
    res.render('editar-produto', {
      produto: produtoRes.rows[0], grupos: gruposRes.rows,
      usuario: req.session.usuario, erro: null,
    });
  } catch (error) {
    console.error('Erro ao carregar produto para edição:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar este produto.' });
  }
});

app.post('/produtos/editar/:id', verificarAutenticacao, async (req, res) => {
  const produto = { ...lerProduto(req.body), id: req.params.id };
  const erro = validarProduto(produto);
  if (erro) return renderEditarProduto(res, req, produto, erro, 400);
  try {
    const resultado = await pool.query(
      `UPDATE produtos
       SET nome_produto = $1, peso = $2, preco = $3, grupo_id = $4
       WHERE id = $5`,
      [produto.nome_produto, produto.peso, produto.preco, produto.grupo_id, produto.id],
    );
    if (resultado.rowCount === 0) return res.status(404).render('404');
    res.redirect('/produtos');
  } catch (error) {
    console.error('Erro ao atualizar produto:', error.message);
    renderEditarProduto(res, req, produto, 'Não foi possível atualizar o produto.', 500);
  }
});

// O relacionamento define ON DELETE SET NULL, conforme o guia.
app.get('/produtos/deletar/:id', verificarAutenticacao, async (req, res) => {
  try {
    await pool.query('DELETE FROM produtos WHERE id = $1', [req.params.id]);
    res.redirect('/produtos');
  } catch (error) {
    console.error('Erro ao excluir produto:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível excluir este produto.' });
  }
});

app.use((req, res) => res.status(404).render('404'));
app.use((error, req, res, next) => {
  console.error('Erro inesperado:', error.message);
  res.status(500).render('erro', { mensagem: 'Ocorreu um erro inesperado. Tente novamente.' });
});

app.listen(port, () => {
  console.log(`Projeto relacional disponível em http://localhost:${port}`);
});

function lerProduto(body) {
  const grupoTexto = String(body.grupo_id || '').trim();
  return {
    nome_produto: String(body.nome_produto || '').trim(),
    peso: String(body.peso || '').trim(),
    preco: String(body.preco || '').trim(),
    grupo_id: grupoTexto ? Number(grupoTexto) : null,
  };
}

function validarProduto(produto) {
  if (!produto.nome_produto) return 'Informe o nome do produto.';
  if (produto.nome_produto.length > 100) return 'O nome deve ter no máximo 100 caracteres.';
  if (!Number.isFinite(Number(produto.peso)) || Number(produto.peso) < 0) return 'Informe um peso válido.';
  if (!Number.isFinite(Number(produto.preco)) || Number(produto.preco) < 0) return 'Informe um preço válido.';
  if (produto.grupo_id !== null && (!Number.isInteger(produto.grupo_id) || produto.grupo_id <= 0)) {
    return 'Selecione um grupo válido ou deixe sem grupo.';
  }
  return null;
}

async function renderNovoProduto(res, req, produto, erro, status) {
  try {
    const grupos = await pool.query('SELECT * FROM grupos ORDER BY descricao_grupo ASC');
    res.status(status).render('novo-produto', { grupos: grupos.rows, usuario: req.session.usuario, produto, erro });
  } catch (error) {
    console.error('Erro ao recarregar grupos:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar o formulário.' });
  }
}

async function renderEditarProduto(res, req, produto, erro, status) {
  try {
    const grupos = await pool.query('SELECT * FROM grupos ORDER BY descricao_grupo ASC');
    res.status(status).render('editar-produto', { grupos: grupos.rows, usuario: req.session.usuario, produto, erro });
  } catch (error) {
    console.error('Erro ao recarregar grupos:', error.message);
    res.status(500).render('erro', { mensagem: 'Não foi possível carregar o formulário.' });
  }
}
