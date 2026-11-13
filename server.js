// Servidor da Impressora de Rosas
// Uso: node server.js henziscooficial
// Lê a live do TikTok e entrega as rosas para o HTML (no PC ou no celular).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const USER = (process.argv[2] || 'henziscooficial').replace('@', '');
const PORT = process.env.PORT || 8080;
const HTML = path.join(__dirname, 'impressora-rosas.html');

const srv = http.createServer((req, res) => {
  fs.readFile(HTML, (e, d) => {
    res.writeHead(e ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(e ? 'impressora-rosas.html nao encontrado' : d);
  });
});
const wss = new WebSocketServer({ server: srv });
const enviar = o => { const s = JSON.stringify(o); wss.clients.forEach(c => c.readyState === 1 && c.send(s)); };
// teste sem live: abra http://localhost:8080/ e use a tecla T, ou chame enviar() abaixo
// mantém a conexão viva (hospedagem gratuita derruba conexão parada)
setInterval(() => wss.clients.forEach(c => { try { c.ping(); } catch (e) {} }), 25000);
srv.listen(PORT, '0.0.0.0', () => console.log(`Servidor ligado na porta ${PORT}. Live: @${USER}`));

(async () => {
  const m = await import('tiktok-live-connector');
  const Conn = m.TikTokLiveConnection || m.WebcastPushConnection;
  const EV = m.WebcastEvent || {};
  const GIFT = EV.GIFT || 'gift', OFF = EV.DISCONNECTED || 'disconnected', ERR = EV.ERROR || 'error';

  function conectar() {
    let tentou = false;
    const retry = () => { if (tentou) return; tentou = true; setTimeout(conectar, 10000); };
    const c = new Conn(USER, { enableExtendedGiftInfo: true });
    c.on(GIFT, g => {
      const u = g.user || {}, d = g.giftDetails || {};
      const tipo = g.giftType ?? d.giftType;
      if (tipo === 1 && !g.repeatEnd) return;                // combo ainda rolando: espera o fim
      const pf = u.profilePicture && (Array.isArray(u.profilePicture.url) ? u.profilePicture.url[0] : u.profilePicture.url);
      enviar({ event: 'gift', data: {
        nickname: g.nickname || u.nickname, uniqueId: g.uniqueId || u.uniqueId,
        profilePictureUrl: g.profilePictureUrl || pf,
        giftName: g.giftName || d.giftName, repeatCount: g.repeatCount || 1 } });
    });
    c.on(OFF, () => { console.log('Desconectado. Tentando de novo...'); retry(); });
    c.on(ERR, e => console.log('Erro:', e && e.message ? e.message : e));
    c.connect().then(() => console.log('Conectado na live de @' + USER),
      e => { console.log('Falha ao conectar (a live esta ligada?):', e && e.message ? e.message : e); retry(); });
  }
  conectar();
})();
