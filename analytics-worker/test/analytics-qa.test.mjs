import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {transform} from 'esbuild';
const source=await transform(readFileSync(new URL('../../src/analytics.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'});
function browser(qa){const storage=new Map(),sessionStorage=new Map(qa?[['quiet-folk-qa','1']]:[]),listeners=[],requests=[];const context={module:{exports:{}},location:{origin:'https://october-with-you.vercel.app',pathname:'/'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},sessionStorage:{getItem:k=>sessionStorage.get(k)||null},crypto:{randomUUID},document:{hidden:false,addEventListener:(...args)=>listeners.push(args)},window:{addEventListener:(...args)=>listeners.push(args)},navigator:{sendBeacon:()=>{requests.push('beacon');return true}},performance:{now:()=>1,getEntriesByType:()=>[]},setInterval:(...args)=>listeners.push(args),fetch:async()=>{requests.push('fetch');return {ok:true}},AbortSignal,console};vm.runInNewContext(source.code,context);return {...context,listeners,requests,storage}}
test('QA mode registers no tracking, timers or exit beacons',async()=>{const page=browser(true);page.module.exports.trackEvent('invitation_yes');await Promise.resolve();assert.equal(page.listeners.length,0);assert.equal(page.requests.length,0);assert.equal(page.storage.size,0)});
test('normal visitors still retain identity and send tracking',async()=>{const page=browser(false);await Promise.resolve();await Promise.resolve();assert.ok(page.listeners.length>0);assert.ok(page.requests.includes('fetch'));assert.ok(page.storage.has('quiet-folk-visitor'))});
