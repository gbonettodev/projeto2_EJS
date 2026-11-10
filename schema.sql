-- Banco relacional: usuarios (login), grupos e produtos (relação 1:N).

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS grupos (
  id SERIAL PRIMARY KEY,
  descricao_grupo VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  nome_produto VARCHAR(100) NOT NULL,
  peso NUMERIC(10, 2) NOT NULL CHECK (peso >= 0),
  preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
  grupo_id INTEGER REFERENCES grupos(id) ON DELETE SET NULL
);

-- Hash validado para a senha inicial 123456.
INSERT INTO usuarios (nome, email, senha)
VALUES (
  'Administrador',
  'admin@email.com',
  '$2b$10$3nB7LvE84f5OYbKTJDqdKuxbDRDur1FB7AdYX9uHf0dxqRbV9TxGO'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO grupos (id, descricao_grupo)
VALUES
  (1, 'Eletrônicos'),
  (2, 'Periféricos'),
  (3, 'Acessórios')
ON CONFLICT (id) DO NOTHING;

-- Ajusta a sequência porque os IDs dos grupos iniciais são inseridos manualmente.
SELECT setval(
  pg_get_serial_sequence('grupos', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM grupos), 1), 1),
  true
);

-- Insere os produtos de demonstração apenas se ainda não existirem.
INSERT INTO produtos (nome_produto, peso, preco, grupo_id)
SELECT sementes.nome_produto, sementes.peso, sementes.preco, sementes.grupo_id
FROM (VALUES
  ('Monitor UltraWide 29"', 4.20::NUMERIC(10, 2), 1299.00::NUMERIC(10, 2), 1),
  ('Teclado Mecânico RGB', 0.95::NUMERIC(10, 2), 280.00::NUMERIC(10, 2), 2),
  ('Mousepad Extra Large', 0.40::NUMERIC(10, 2), 65.00::NUMERIC(10, 2), 3)
) AS sementes(nome_produto, peso, preco, grupo_id)
WHERE NOT EXISTS (
  SELECT 1 FROM produtos existentes
  WHERE existentes.nome_produto = sementes.nome_produto
);
