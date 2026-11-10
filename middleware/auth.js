export function verificarAutenticacao(req, res, next) {
  if (req.session?.usuario) return next();
  res.redirect('/login');
}
