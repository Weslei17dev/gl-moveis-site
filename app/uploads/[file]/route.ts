import { env } from 'cloudflare:workers';
export async function GET(req:Request,{params}:{params:Promise<{file:string}>}){
  const {file}=await params;if(!/^[0-9a-f-]{36}\.(pdf|jpe?g|png|webp)$/i.test(file))return new Response('Não encontrado',{status:404});
  const key='uploads/'+file,range=req.headers.get('range');let object;
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new Response(null,{status:416});const offset=Number(match[1]);const length=match[2]?Number(match[2])-offset+1:undefined;object=await env.BUCKET!.get(key,{range:{offset,length}});}else object=await env.BUCKET!.get(key);
  if(!object)return new Response('Não encontrado',{status:404});
  const h=new Headers();object.writeHttpMetadata(h);h.set('Accept-Ranges','bytes');h.set('Cache-Control','public, max-age=3600');h.set('X-Content-Type-Options','nosniff');
  if(range&&object.range){const m=/^bytes=(\d+)-(\d*)$/.exec(range)!;const start=Number(m[1]);const end=m[2]?Math.min(Number(m[2]),object.size-1):object.size-1;h.set('Content-Range',`bytes ${start}-${end}/${object.size}`);return new Response(object.body,{status:206,headers:h});}
  return new Response(object.body,{headers:h});
}
