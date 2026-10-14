import { env } from 'cloudflare:workers';
import seed from '../../../seed.json';

const ADMIN_EMAIL = 'wesleidecampos57@gmail.com';
const json = (value: unknown, status=200, extra: Record<string,string>={}) => Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const error = (message:string,status=400)=>json({error:message},status);
const visible=(d:any)=>{const catalogs=d.catalogs.filter((c:any)=>c.active).sort((a:any,b:any)=>a.order-b.order);return {...d,catalogs,products:d.products.filter((p:any)=>p.active&&catalogs.some((c:any)=>c.id===p.catalogId))};};
async function current(){
  const db=env.DB!;
  let row=await db.prepare('SELECT data, revision FROM content WHERE id = 1').first<{data:string,revision:number}>();
  if(!row){await db.prepare('INSERT OR IGNORE INTO content (id,revision,data,updated_at) VALUES (1,1,?,?)').bind(JSON.stringify(seed),new Date().toISOString()).run();row=await db.prepare('SELECT data, revision FROM content WHERE id = 1').first<{data:string,revision:number}>();}
  if(!row)throw Error('Conteúdo indisponível');
  return {...JSON.parse(row.data),revision:row.revision};
}
function authorized(req:Request){return !!req.headers.get('oai-authenticated-user-id') && req.headers.get('oai-authenticated-user-email')?.toLowerCase()===ADMIN_EMAIL;}
function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
function valid(d:any){
  if(!d||!d.settings||!Array.isArray(d.catalogs)||!Array.isArray(d.products)||d.catalogs.length>2000||d.products.length>10000)throw Error('Formato de cadastro inválido.');
  const s=(v:any,max=300,required=false)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Confira os campos obrigatórios.');return v.trim();};
  const a=(v:any,pdf=false,required=false)=>{v=s(v||'',300,required);if(v&&!(/^(uploads|catalogos)\//.test(v)&&pdf&&/\.pdf$/i.test(v)||/^(uploads|assets\/images)\//.test(v)&&!pdf&&/\.(jpg|jpeg|png|webp)$/i.test(v))||v.includes('..')||/[\\?#\x00-\x1f]/.test(v))throw Error('Arquivo inválido.');return v;};
  const settings={...d.settings};for(const k of ['name','tagline','phone','whatsapp','instagram','location','serviceArea','payment','delivery','deliveryNote','heroTitle','heroText','heroCaption'])settings[k]=s(settings[k]||'',1000,k==='name'||k==='heroTitle');settings.logo=a(settings.logo,false,true);settings.heroImage=a(settings.heroImage,false,true);settings.showPrices=settings.showPrices===true;
  if(settings.whatsapp&&!/^\d{10,15}$/.test(settings.whatsapp))throw Error('WhatsApp inválido.');
  const ids=new Set<string>();const id=(v:any)=>{v=s(v,90,true);if(!/^[a-zA-Z0-9_-]+$/.test(v)||ids.has(v))throw Error('Identificador repetido ou inválido.');ids.add(v);return v;};
  const catalogs=d.catalogs.map((c:any,i:number)=>({id:id(c.id),title:s(c.title,160,true),brand:s(c.brand,80,true),year:Number(c.year),description:s(c.description||'',1000),categories:Array.isArray(c.categories)?c.categories.slice(0,20).map((x:any)=>s(x,80,true)):[],image:a(c.image,false,true),cover:a(c.cover),pdf:a(c.pdf,true,true),pages:Number(c.pages),size:Number(c.size)||0,active:c.active===true,order:Number(c.order??i),updatedAt:s(c.updatedAt||new Date().toISOString(),50)}));
  ids.clear();const products=d.products.map((p:any)=>{const c=catalogs.find((c:any)=>c.id===p.catalogId);if(!c)throw Error('Produto sem catálogo.');return {id:id(p.id),name:s(p.name,160,true),brand:c.brand,category:s(p.category,80,true),price:p.price===null||p.price===''?null:Number(p.price),image:a(p.image,false,true),catalogId:c.id,page:Number(p.page),description:s(p.description||'',3000),dimensions:s(p.dimensions||'',500),colors:s(p.colors||'',1000),code:s(p.code||'',100),active:p.active===true,featured:p.featured===true,updatedAt:s(p.updatedAt||new Date().toISOString(),50)};});
  if(catalogs.some((c:any)=>!Number.isInteger(c.year)||c.year<2000||c.year>2200||!Number.isInteger(c.pages)||c.pages<1||!Number.isInteger(c.order))||products.some((p:any)=>!Number.isInteger(p.page)||p.page<1||p.page>catalogs.find((c:any)=>c.id===p.catalogId).pages||p.price!==null&&(!Number.isFinite(p.price)||p.price<0)))throw Error('Valores numéricos inválidos.');
  return {version:1,settings,catalogs,products};
}
async function handle(req:Request){
  const url=new URL(req.url),path=url.pathname,method=req.method;
  if(!env.DB||!env.BUCKET)return error('Armazenamento temporariamente indisponível.',503);
  if(path==='/api/health')return json({ok:true});
  if(path==='/api/conteudo'&&method==='GET')return json(visible(await current()));
  if(path==='/api/admin/session'&&method==='GET')return json({configured:true,authenticated:authorized(req),username:authorized(req)?'Administrador':'',csrf:''});
  if(!authorized(req))return error('Entre com a conta administradora do ChatGPT para acessar o painel.',401);
  if(method!=='GET'&&!sameOrigin(req))return error('Origem não permitida.',403);
  if(path==='/api/admin/conteudo'){
    if(method==='GET')return json(await current());
    if(method==='PUT'){
      const input=await req.json() as any,prior=await current();if(input.revision!==prior.revision)return error('Outra aba atualizou os cadastros. Recarregue o painel.',409);
      const data={...valid(input),revision:prior.revision+1,updatedAt:new Date().toISOString()};
      const result=await env.DB.prepare('UPDATE content SET data=?, revision=?, updated_at=? WHERE id=1 AND revision=?').bind(JSON.stringify(data),data.revision,data.updatedAt,prior.revision).run();
      if(result.meta.changes!==1)return error('Outra aba atualizou os cadastros. Recarregue o painel.',409);
      await env.BUCKET.put(`backups/conteudo-${Date.now()}.json`,JSON.stringify(prior));return json(data);
    }
  }
  if(path==='/api/admin/backup'&&method==='GET')return json(await current(),200,{'Content-Disposition':'attachment; filename="gl-moveis-cadastros.json"'});
  if(path==='/api/admin/upload'&&method==='POST'){
    const file=req.headers.get('x-file-name')||'',ext=/\.(pdf|jpe?g|png|webp)$/i.exec(file)?.[0].toLowerCase();if(!ext)return error('Use PDF, JPG, PNG ou WebP.');
    const max=(ext==='.pdf'?150:15)*1048576,n=Number(req.headers.get('content-length'));if(!n||n>max)return error('Arquivo acima do limite ou sem tamanho definido.',413);
    const mime=ext==='.pdf'?'application/pdf':ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg';
    const key=`uploads/${crypto.randomUUID()}${ext}`;await env.BUCKET.put(key,req.body,{httpMetadata:{contentType:mime},customMetadata:{originalName:file.slice(0,200)}});return json({path:key,size:n},201);
  }
  return error('Operação não encontrada.',404);
}
export async function GET(req:Request){try{return await handle(req);}catch(e){console.error(e);return error('Não foi possível concluir. Tente novamente.',500)}}
export async function PUT(req:Request){try{return await handle(req);}catch(e){return error(e instanceof Error?e.message:'Não foi possível salvar.',400)}}
export async function POST(req:Request){try{return await handle(req);}catch(e){console.error(e);return error('Não foi possível enviar o arquivo.',500)}}
