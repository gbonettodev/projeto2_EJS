# Bonettocenter — Mini Projeto SSR Relacional

Projeto acadêmico com Node.js, Express, EJS e PostgreSQL, seguindo o Guia V4. A relação estudada é entre `grupos` e `produtos` (um grupo pode conter vários produtos). A tabela `usuarios` é usada para autenticação.

## Funcionalidades do guia

- Login com bcrypt e sessão Express.
- CRUD de grupos (listar, cadastrar e excluir).
- CRUD de produtos (listar, cadastrar, editar e excluir).
- Relação de chave estrangeira `produtos.grupo_id` → `grupos.id`.
- Consulta de produtos com `LEFT JOIN`, mostrando a descrição do grupo.
- Busca por nome do produto ou descrição do grupo.
- Formulários de produto com seleção de grupo carregada do PostgreSQL.
- Exclusão de grupo preserva os produtos vinculados e deixa `grupo_id` nulo.

## Preparar o projeto

No terminal desta pasta, execute:

```bash
npm install
```

O projeto usa a porta 3000, conforme o guia do professor. Encerre o servidor do projeto anterior antes de iniciar este, para liberar a porta.

Copie `.env.example` para `.env` e troque `PGPASSWORD` pela senha definida na instalação do PostgreSQL. Não compartilhe nem envie o arquivo `.env`.

## Preparar o PostgreSQL

Este projeto usa um banco separado, `meu_banco_db_relacional`, para não misturar as tabelas do projeto anterior.

1. No pgAdmin, clique com o botão direito em **Databases** e escolha **Create → Database…**.
2. Nomeie o banco `meu_banco_db_relacional` e clique em **Save**.
3. Selecione esse banco, abra **Tools → Query Tool** e execute todo o conteúdo de `schema.sql`.
4. O script cria `usuarios`, `grupos`, `produtos`, a chave estrangeira e os dados iniciais.

Se o professor exigir exatamente o banco `meu_banco_db` do exemplo, altere `PGDATABASE` no `.env`. Como esse nome já está sendo usado pelo projeto anterior, o banco separado é recomendado para evitar conflito de estrutura.

## Iniciar e acessar

```bash
npm start
```

Abra `http://localhost:3000`.

- E-mail inicial: `admin@email.com`
- Senha inicial: `123456`

## Arquivos importantes

- `app.js`: servidor Express e rotas SSR.
- `db.js`: pool de conexões PostgreSQL.
- `schema.sql`: tabelas, relação, administrador e dados de exemplo.
- `middleware/auth.js`: proteção das rotas privadas.
- `views/`: telas EJS.
- `public/css/style.css`: estilos responsivos.
- `gerar-hash.js`: demonstra a geração do hash bcrypt da senha inicial.
