const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const mount = require('koa-mount');
const processesRouter = require('./routes/processes');

const app = new Koa();

app.use(bodyParser());

// 统一挂载到 /api 前缀
app.use(mount('/api', processesRouter));

app.listen(3000, () => {
  console.log('服务运行在3000端口');
}); 