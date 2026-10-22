// Smoke test for the published static demo.  usage: node scripts/check_demo.cjs <base url> [screenshot dir]
// Used by .github/workflows/demo-check.yml; exits non-zero when a check fails or the page logs a console error.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const remote=process.argv[2], out=process.argv[3], root='';
let U=remote,srv;
if(!remote){const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.ico':'image/x-icon'};
 srv=http.createServer((q,res)=>{let u=decodeURIComponent(q.url.split('?')[0]);const PFX=process.env.PFX||'';if(PFX&&u.startsWith(PFX))u=u.slice(PFX.length)||'/';let p=path.join(root,u);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');fs.readFile(p,(e,d)=>{if(e){res.statusCode=404;return res.end('nf')}res.setHeader('content-type',mime[path.extname(p)]||'application/octet-stream');res.end(d)})}).listen(8751);U='http://localhost:8751'+(process.env.PFX||'');}
let failed=0;const ok=(n,c,x='')=>{if(!c)failed++;console.log(c?'PASS':'FAIL',n,x)};
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[],bad=[];
 p.on('console',m=>m.type()==='error'&&errs.push(m.text().slice(0,160)));p.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,160)));p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url().slice(0,100))});
 const body=async()=>p.locator('body').innerText();
 const shot=async n=>{if(out){fs.mkdirSync(out,{recursive:true});await p.waitForTimeout(500);await p.screenshot({path:out+'/'+n+'.png'})}};
 await p.goto(U+'/',{waitUntil:'networkidle'});ok('role chooser',/Student/.test(await body())&&/Lecturer/.test(await body())&&/Admin/.test(await body()));await shot('00-roles');
 // student
 await p.click('a[href*="/s/home"]');await p.waitForLoadState('networkidle');ok('student home',/Hello,/.test(await body()),p.url());await shot('01-student-home');
 for(const [label,hrefPart,expect] of [['Intro','/intro',/Introd|Question/],['Pipeline','/pipeline',/Pipeline/],['Dashboard','/progress',/Progress/],['Path','/learning-path',/Learn/]]){
   await p.locator(`nav a:has-text("${label}"), a:has-text("${label}")`).first().click();await p.waitForLoadState('networkidle');ok('student nav '+label,expect.test(await body()),p.url().replace(U,''));}
 await shot('02-student-progress');
 await p.goto(U+'/s/exercise_q_0.html',{waitUntil:'networkidle'});await p.check('input[value="Deploy"]');await p.click('button:has-text("Submit Answer")');await p.waitForLoadState('networkidle');const wrong=await body();ok('MCQ wrong answer feedback',/not correct|Incorrect|incorrect/i.test(wrong),p.url().replace(U,''));
 await p.goto(U+'/s/exercise_q_0.html',{waitUntil:'networkidle'});await p.check('input[value="Build"]');await p.click('button:has-text("Submit Answer")');await p.waitForLoadState('networkidle');ok('MCQ correct answer feedback',/correct|Correct/.test(await body())&&/__correct/.test(p.url()));await shot('03-exercise-correct');
 // code question with Monaco + fixtures
 await p.goto(U+'/s/exercise_q_1.html',{waitUntil:'networkidle'});await p.waitForTimeout(2500);ok('Monaco editor loaded',await p.locator('.monaco-editor').count()>0);
 await p.evaluate(()=>{const m=window.monaco.editor.getModels()[0];m.setValue('def solve(a, b):\n    return a + b')});
 await p.locator('button:has-text("Run")').first().click();await p.waitForTimeout(1500);const o=await body();ok('sandbox result from fixtures (pass)',/passed|PASS|✅|Passed/i.test(o)||/3\/3/.test(o));await shot('04-code-run');
 await p.evaluate(()=>{window.monaco.editor.getModels()[0].setValue('def solve(a, b):\n    pass')});await p.locator('button:has-text("Run")').first().click();await p.waitForTimeout(1500);ok('sandbox result from fixtures (fail)',/fail|Fail|✗|❌|0\/3|Expected/i.test(await body()));
 // lecturer
 await p.goto(U+'/',{waitUntil:'networkidle'});await p.click('a[href*="/l/home"]');await p.waitForLoadState('networkidle');ok('lecturer dashboard',/Lecturer|Dashboard/.test(await body()),p.url().replace(U,''));await shot('05-lecturer');
 for(const label of ['Questions','Theory','Submissions']){const l=p.locator(`a:has-text("${label}")`).first();if(await l.count()){await l.click();await p.waitForLoadState('networkidle');ok('lecturer '+label,true,p.url().replace(U,''));}else ok('lecturer '+label,false,'no link')}
 await shot('06-lecturer-questions');
 // admin
 await p.goto(U+'/',{waitUntil:'networkidle'});await p.click('a[href*="/a/home"]');await p.waitForLoadState('networkidle');ok('admin dashboard',/Admin|Dashboard/.test(await body()),p.url().replace(U,''));await shot('07-admin');
 for(const label of ['Users','Modules','Audit','Reports','Settings']){const l=p.locator(`a:has-text("${label}")`).first();if(await l.count()){await l.click();await p.waitForLoadState('networkidle');ok('admin '+label,!/not part of the demo/i.test(await body()),p.url().replace(U,''));if(label==='Users')await shot('08-admin-users')}else ok('admin '+label,false,'no link')}
 await p.setViewportSize({width:375,height:812});await p.goto(U+'/s/home.html',{waitUntil:'networkidle'});ok('mobile no horizontal scroll',(await p.evaluate(()=>document.documentElement.scrollWidth))<=376);
 console.log('errors',JSON.stringify(errs.slice(0,6)),'bad',JSON.stringify(bad.slice(0,6)));if(errs.length||bad.length)failed++;await b.close();console.log(failed?'FAILED':'ALL CHECKS PASSED');process.exit(failed?1:0);})().catch(e=>{console.error(e);process.exit(1)});
