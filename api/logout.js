// GET — clears the login cookie and returns to the login page.
module.exports = function handler(req, res) {
  res.setHeader('Set-Cookie', 'oa_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.statusCode = 302;
  res.setHeader('Location', '/login?out=1');
  res.end();
};
