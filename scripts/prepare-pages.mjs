import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export async function preparePages(source, output, revision) {
  if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error('Expected a full Git commit SHA');
  const release = 'releases/'+revision+'/';
  await mkdir(output,{recursive:true});
  await cp(source,output,{recursive:true});
  // Pages replaces the previous release directory. Open tabs still need the same media URLs.
  await cp(source,path.join(output,release),{recursive:true,filter:file=>!['sw.js','help'].includes(path.relative(source,file))});
  // Relative imports from app.js now stay within this immutable release directory.
  const html = (await readFile(path.join(source,'index.html'),'utf8'))
    .replace('href="./styles.css"',`href="./${release}styles.css"`)
    .replace('src="./app.js"',`src="./${release}app.js"`);
  await writeFile(path.join(output,'index.html'),html);
  await writeFile(path.join(output,release,'index.html'),html);
  const worker = await readFile(path.join(source,'sw.js'),'utf8');
  await writeFile(path.join(output,'sw.js'),worker.replace('__BUILD_REVISION__',revision));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await preparePages(...process.argv.slice(2));
}
