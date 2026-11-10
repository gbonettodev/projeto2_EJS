import bcrypt from 'bcrypt';

const senhaPlana = '123456';
const saltRounds = 10;

async function gerarHashSenha() {
  try {
    const hash = await bcrypt.hash(senhaPlana, saltRounds);
    console.log(`Hash bcrypt gerado para a senha inicial ${senhaPlana}:`);
    console.log(hash);
  } catch (error) {
    console.error('Erro ao gerar o hash:', error.message);
    process.exitCode = 1;
  }
}

gerarHashSenha();
