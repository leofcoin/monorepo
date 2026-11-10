import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, extname, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { encodeWire, BINARY_CONTENT_TYPE } from '@leofcoin/binary'

// Opt in after `npm run build`; uses only a local fixture and native CDP.
// RUN_SHELL_UI_TESTS=1 CHROME_BIN="/path/to/chrome" node --test test/shell-ui.test.js
const runShellUiTests = process.env.RUN_SHELL_UI_TESTS === '1' && Boolean(process.env.CHROME_BIN)

test('Spaces UI joins, manages moderator channels, keeps histories separate and revokes future access', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { default: generateAccount } = await import('@leofcoin/generate-account')
  const { default: IdentityController } = await import('../src/controllers/identity.ts')
  const { createDeviceCertificate } = await import('../src/controllers/chat-security.js')
  const network = 'leofcoin:peach'
  async function testDevice() {
    const password = 'isolated-spaces-browser-test'
    const wallet = await generateAccount(password, network)
    globalThis.walletStore = { get: async () => new TextEncoder().encode(JSON.stringify(wallet.accounts)) }
    const identity = new IdentityController(network, wallet); await identity.unlock(password)
    const account = wallet.accounts[0][1], deviceId = crypto.randomUUID(), peerId = `test-${deviceId}`
    // Extractable keys exist only in this synthetic fixture, never a real wallet or saved device.
    const encryption = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey'])
    const signing = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
    const keys = {encryption:{privateKey:encryption.privateKey,publicKey:new Uint8Array(await crypto.subtle.exportKey('raw',encryption.publicKey))},
      signing:{privateKey:signing.privateKey,publicKey:new Uint8Array(await crypto.subtle.exportKey('raw',signing.publicKey))}}
    const signer = await identity.signer(account)
    const certificate = await createDeviceCertificate({account,network,deviceId,peerId,keys,signWithAccount:signer.sign})
    return {account,network,deviceId,peerId,certificate,
      encryption:await crypto.subtle.exportKey('jwk',encryption.privateKey),signing:await crypto.subtle.exportKey('jwk',signing.privateKey),
      encryptionPublic:[...keys.encryption.publicKey],signingPublic:[...keys.signing.publicKey]}
  }
  const ownerDevice = await testDevice(), memberDevice = await testDevice()
  const fixture = await createShellFixture(t)
  const member = await fixture.newTab()
  const memberWait = expression => member.evaluate(`await new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{
    if(${expression}){clearInterval(timer);resolve()}else if(++tries>150){clearInterval(timer);reject(Error(chat.error||'Member UI timed out'))}},20)});true`)
  async function seed(evaluate, device) {
    await evaluate(`
      await import('/chat.js'); shell.style.display='none';
      const fixtureDevice = ${JSON.stringify(device)};
      fixtureDevice.keys = {encryption:{privateKey:await crypto.subtle.importKey('jwk',fixtureDevice.encryption,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey']),publicKey:new Uint8Array(fixtureDevice.encryptionPublic)},
        signing:{privateKey:await crypto.subtle.importKey('jwk',fixtureDevice.signing,{name:'ECDSA',namedCurve:'P-256'},false,['sign']),publicKey:new Uint8Array(fixtureDevice.signingPublic)}};
      await new Promise((resolve,reject)=>{
        const request=indexedDB.open('leofcoin-chat-devices',2);
        request.onupgradeneeded=()=>{request.result.createObjectStore('devices',{keyPath:'id'});request.result.createObjectStore('spaces',{keyPath:'id'})};
        request.onerror=()=>reject(request.error);
        request.onsuccess=()=>{const db=request.result,tx=db.transaction('devices','readwrite');
          tx.objectStore('devices').put({id:fixtureDevice.network+':'+fixtureDevice.account,...fixtureDevice});
          tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
      });
      globalThis.fixturePackets=[]; globalThis.fixtureHeldPackets=[];globalThis.fixtureHoldPackets=false;
      globalThis.chatBroker=new BroadcastChannel('isolated-chat-spaces-test');
      globalThis.peernet={id:fixtureDevice.peerId,
        subscribe:async(topic,handler)=>{chatBroker.onmessage=event=>handler(event.data);return()=>chatBroker.onmessage=null},
        publish:async(topic,packet)=>{if(!(packet instanceof Uint8Array))throw Error('Non-binary packet');fixturePackets.push(packet);
          if(fixtureHoldPackets)fixtureHeldPackets.push(packet);else chatBroker.postMessage(packet)}};
      globalThis.identityController={signer:async()=>({sign:async()=>{throw Error('Saved fixture device must not request wallet signing')}})};
      globalThis.chat=document.createElement('chat-view');chat.style.cssText='position:fixed;inset:0;font-family:system-ui;background:#191b20';
      chat.wallet={selectedAccount:fixtureDevice.account};document.body.append(chat);true;
    `)
    await evaluate(`await new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{
      if(chat.connected){clearInterval(timer);resolve()}else if(++tries>150){clearInterval(timer);reject(Error(chat.error||'Chat startup timeout'))}},20)});true`)
  }
  await seed(fixture.evaluate, ownerDevice); await seed(member.evaluate, memberDevice)
  await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="New conversation"]').click();await chat.updateComplete;
    const friend=chat.shadowRoot.querySelector('dialog input');friend.value=${JSON.stringify(memberDevice.peerId)};friend.dispatchEvent(new Event('input'));
    await chat.updateComplete;chat.shadowRoot.querySelector('dialog form').requestSubmit();true`)
  await fixture.waitFor(`chat.friends.includes(${JSON.stringify(memberDevice.peerId)}) && !chat.shadowRoot.querySelector('dialog')`)
  await fixture.evaluate(`chat.shadowRoot.querySelector('.space-actions button').click();await chat.updateComplete;
    const input=chat.shadowRoot.querySelector('dialog input');input.value='Community Space';input.dispatchEvent(new Event('input'));
    await chat.updateComplete;chat.shadowRoot.querySelector('dialog form').requestSubmit();true`)
  await fixture.waitFor(`chat.shadowRoot.querySelector('dialog')?.textContent.includes('Generate invitation')`)
  await fixture.evaluate(`[...chat.shadowRoot.querySelectorAll('dialog button')].find(button=>button.textContent.trim()==='Generate invitation').click();true`)
  await fixture.waitFor(`chat.generatedInvite && chat.inviteQr`)
  const link = await fixture.evaluate('chat.generatedInvite')
  assert.match(link, /#!\/chat\?invite=/)
  assert.equal(await fixture.evaluate(`chat.shadowRoot.querySelector('img.invite-qr').src.startsWith('data:image/png')`), true)
  await member.evaluate(`chat.applyRouteParameters({invite:${JSON.stringify(new URLSearchParams(new URL(link).hash.split('?')[1]).get('invite'))}});true`)
  await member.evaluate(`await new Promise(resolve=>{const timer=setInterval(()=>{if(chat.invitePreview){clearInterval(timer);resolve()}},10)});true`)
  assert.equal(await member.evaluate(`chat.spaces.length`), 0, 'a valid link only opens a preview')
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('dialog').textContent.includes('Community Space')`), true)
  await member.evaluate(`[...chat.shadowRoot.querySelectorAll('dialog button')].find(button=>button.textContent.trim()==='Request to join').click();true`)
  await fixture.waitFor(`chat.spaces[0]?.requests?.length === 1`)
  assert.equal(await member.evaluate(`chat.spaces[0].status`), 'requested')
  await fixture.evaluate(`[...chat.shadowRoot.querySelectorAll('dialog button')].find(button=>button.textContent.trim()==='Approve').click();true`)
  await member.evaluate(`await new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{
    if(chat.spaces[0]?.status==='joined'){clearInterval(timer);resolve()}else if(++n>150){clearInterval(timer);reject(Error(chat.error))}},20)});true`)
  await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Close dialog"]').click();await chat.updateComplete;
    const input=chat.shadowRoot.querySelector('.composer textarea');input.value='Hello, invited member!';input.dispatchEvent(new Event('input'));
    await chat.updateComplete;chat.shadowRoot.querySelector('.composer').requestSubmit();true`)
  await member.evaluate(`await new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{
    if(chat.messages.some(message=>message.text==='Hello, invited member!')){clearInterval(timer);resolve()}else if(++n>150){clearInterval(timer);reject(Error(chat.error))}},20)});true`)
  assert.equal(await fixture.evaluate(`fixturePackets.every(packet=>!new TextDecoder().decode(packet).includes('Hello, invited member!'))`), true)
  await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
  await fixture.waitFor(`chat.shadowRoot.querySelector('dialog')?.open`)
  await fixture.evaluate(`chat.shadowRoot.querySelector('.moderator-role').click();true`)
  await memberWait(`chat.spaces[0]?.manifest.roles?.length === 1`)
  await member.evaluate(`chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
  await memberWait(`chat.shadowRoot.querySelector('dialog')?.open`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelectorAll('.moderator-role').length`), 0, 'moderators cannot assign roles')
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('dialog').textContent.includes('Generate invitation')`), false)
  await fixture.evaluate(`fixtureHoldPackets=true;true`)
  await member.evaluate(`const name=chat.shadowRoot.querySelector('[aria-label="Channel name"]');name.value='development';name.dispatchEvent(new Event('input'));
    const topic=chat.shadowRoot.querySelector('[aria-label="Channel topic"]');topic.value='Build together';topic.dispatchEvent(new Event('input'));
    await chat.updateComplete;chat.shadowRoot.querySelector('.channel-form').requestSubmit();true`)
  await fixture.waitFor(`chat.spaces[0].manifest.channels.length === 2`)
  assert.equal(await member.evaluate(`chat.spaces[0].manifest.channels.length`), 1, 'moderator change is pending until owner-signed update arrives')
  assert.equal(await member.evaluate(`chat.spaces[0].channelRequests.at(-1).status`), 'pending')
  await fixture.evaluate(`fixtureHoldPackets=false;for(const packet of fixtureHeldPackets.splice(0))chatBroker.postMessage(packet);true`)
  await memberWait(`chat.spaces[0].manifest.channels.length === 2 && chat.spaces[0].channelRequests.at(-1).status === 'applied'`)
  const developmentId = await fixture.evaluate(`chat.spaces[0].manifest.channels.find(channel=>channel.name==='development').id`)
  for (const page of [fixture,member]) await page.evaluate(`chat.shadowRoot.querySelector('[aria-label="Close dialog"]').click();await chat.updateComplete;
    chat.shadowRoot.querySelector('[data-channel="${developmentId}"]').click();await chat.updateComplete;true`)
  await fixture.evaluate(`const input=chat.shadowRoot.querySelector('.composer textarea');input.value='Only in development';input.dispatchEvent(new Event('input'));
    await chat.updateComplete;chat.shadowRoot.querySelector('.composer').requestSubmit();true`)
  await memberWait(`chat.messages.some(message=>message.text==='Only in development')`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.messages').textContent.includes('Only in development')`),true)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.messages').textContent.includes('Hello, invited member!')`),false)
  await member.evaluate(`chat.shadowRoot.querySelector('[data-channel="general"]').click();await chat.updateComplete;
    const input=chat.shadowRoot.querySelector('.composer textarea');input.value='General draft';input.dispatchEvent(new Event('input'));
    chat.shadowRoot.querySelector('[data-channel="${developmentId}"]').click();await chat.updateComplete;true`)
  assert.equal(await member.evaluate('chat.draft'),'')
  await member.evaluate(`const input=chat.shadowRoot.querySelector('.composer textarea');input.value='Development draft';input.dispatchEvent(new Event('input'));
    chat.shadowRoot.querySelector('[data-channel="general"]').click();await chat.updateComplete;true`)
  assert.equal(await member.evaluate('chat.draft'),'General draft')
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.messages').textContent.includes('Only in development')`),false)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.messages').textContent.includes('Hello, invited member!')`),true)
  await member.evaluate(`chat.shadowRoot.querySelector('[data-channel="${developmentId}"]').click();await chat.updateComplete;
    chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
  await memberWait(`chat.shadowRoot.querySelector('dialog')?.open`)
  await member.evaluate(`chat.shadowRoot.querySelector('[aria-label="Archive channel development"]').click();true`)
  await memberWait(`chat.spaces[0].manifest.channels.find(channel=>channel.name==='development').archived`)
  await member.evaluate(`chat.shadowRoot.querySelector('[aria-label="Close dialog"]').click();await chat.updateComplete;true`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.composer') === null`),true)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.messages').textContent.includes('Only in development')`),true, 'archiving preserves history')
  await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
  await fixture.waitFor(`chat.shadowRoot.querySelector('dialog')?.open`)
  await fixture.evaluate(`chat.shadowRoot.querySelector('.moderator-role').click();true`)
  await memberWait(`chat.spaces[0].manifest.roles.length === 0`)
  await member.evaluate(`chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
  await memberWait(`chat.shadowRoot.querySelector('dialog')?.open`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.channel-form') === null`),true,'demoted member has no channel controls')
  await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Restore channel development"]').click();true`)
  await memberWait(`!chat.spaces[0].manifest.channels.find(channel=>channel.name==='development').archived`)
  await member.evaluate(`chat.shadowRoot.querySelector('[aria-label="Close dialog"]').click();await chat.updateComplete;true`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.composer') !== null`),true)
  if (process.env.LFC_UI_SCREENSHOTS) {
    await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Close dialog"]').click();await chat.updateComplete;true`)
    const shot = await fixture.call('Page.captureScreenshot',{format:'png'})
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS,'space-channels-desktop.png'),Buffer.from(shot.data,'base64'))
    await fixture.evaluate(`chat.shadowRoot.querySelector('[aria-label="Conversation settings"]').click();true`)
    await fixture.waitFor(`chat.shadowRoot.querySelector('dialog')?.open`)
  }
  await fixture.evaluate(`[...chat.shadowRoot.querySelectorAll('dialog button')].find(button=>button.textContent.trim()==='Remove').click();await chat.updateComplete;true`)
  assert.equal(await fixture.evaluate(`chat.spaces[0].manifest.members.length`), 2, 'removal requires confirmation')
  await fixture.evaluate(`[...chat.shadowRoot.querySelectorAll('dialog button')].find(button=>button.textContent.trim()==='Confirm').click();true`)
  await member.evaluate(`await new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{
    if(chat.spaces[0]?.status==='removed'){clearInterval(timer);resolve()}else if(++n>150){clearInterval(timer);reject(Error(chat.error))}},20)});true`)
  assert.equal(await member.evaluate(`chat.shadowRoot.querySelector('.composer') === null`), true)
  assert.equal(await fixture.evaluate(`chat.spaces[0].invites.length`), 0)
  await fixture.resize(390, 844)
  await fixture.waitFor(`chat.shadowRoot.querySelector('dialog')?.open && !chat.busy`)
  assert.equal(await fixture.evaluate(`chat.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  if (process.env.LFC_UI_SCREENSHOTS) {
    const shot = await fixture.call('Page.captureScreenshot',{format:'png'})
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS,'space-members-mobile.png'),Buffer.from(shot.data,'base64'))
  }
  assert.deepEqual(fixture.errors, [])
})

test('chat has compact safe messages, conversation drafts, accessible settings and single-pane mobile navigation', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  // Render-only data. No wallet, keys, transport, real peers or outbound messages.
  await evaluate(`
    await import('/chat.js');
    shell.style.display = 'none';
    globalThis.chat = document.createElement('chat-view');
    chat.style.cssText = 'position:fixed;inset:0;z-index:1000;font-family:system-ui;background:#191b20';
    document.body.append(chat);
    chat.device = { account: 'fixture-me', peerId: 'fixture-own-peer', deviceId: 'fixture-self', certificate:{account:'fixture-me',deviceId:'fixture-self',signingKey:'fixture-sign',encryptionKey:'fixture-encryption'} };
    chat.connected = true;
    chat.friends = ['fixture-alice', 'fixture-bob'];
    chat.devices = [{account:'fixture-alice',peerId:'fixture-alice',deviceId:'fixture-alice-device'},
      {account:'fixture-bob',peerId:'fixture-bob',deviceId:'fixture-bob-device'}];
    chat.spaces = [{spaceId:'fixture-space',name:'Friends & family',ownerAccount:'fixture-me',status:'joined',keyBytes:new Uint8Array(32),
      manifest:{members:[chat.device.certificate],authority:chat.device.certificate,revision:1}}];
    chat.messages = [
      {id:'1',sender:'fixture-me',spaceId:'fixture-space',text:'test',timestamp:Date.now(),outgoing:true},
      {id:'2',sender:'fixture-alice',spaceId:'fixture-space',text:'A much better place to catch up.\\nEven with a second line.',timestamp:Date.now(),outgoing:false},
      {id:'3',sender:'fixture-alice',conversationId:'fixture-alice',text:'Coffee tomorrow?',timestamp:Date.now(),outgoing:false},
      {id:'4',sender:'fixture-me',conversationId:'fixture-alice',text:'<img src=x onerror=alert(1)>',timestamp:Date.now(),outgoing:true,deliveryState:'queued'}
    ];
    await chat.updateComplete;
    chat.shadowRoot.querySelector('.space-item').click(); await chat.updateComplete; true;
  `)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.message').getBoundingClientRect().height < 90`), true)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.message-text').textContent`), 'test')
  assert.equal(await evaluate(`getComputedStyle(chat.shadowRoot.querySelector('.message')).whiteSpace`), 'normal')
  assert.equal(await evaluate(`getComputedStyle(chat.shadowRoot.querySelector('.message-text')).whiteSpace`), 'pre-wrap')
  assert.equal(await evaluate(`chat.shadowRoot.querySelectorAll('.day').length`), 1)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.sidebar').textContent.includes('Offline delivery')`), false)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('dialog') === null`), true)
  if (process.env.LFC_UI_SCREENSHOTS) {
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS, 'chat-desktop.png'), Buffer.from(shot.data, 'base64'))
  }
  await click(`chat.shadowRoot.querySelector('.friend-item')`)
  await evaluate(`await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.shadowRoot.querySelectorAll('img').length`), 0)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.message-state').textContent`), 'Pending delivery')
  await evaluate(`chat.shadowRoot.querySelector('textarea').value = 'Only for Alice';
    chat.shadowRoot.querySelector('textarea').dispatchEvent(new Event('input', {bubbles:true}));
    chat.shadowRoot.querySelectorAll('.friend-item')[1].click(); await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.draft`), '')
  await evaluate(`chat.shadowRoot.querySelectorAll('.friend-item')[0].click(); await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.draft`), 'Only for Alice')
  await evaluate(`globalThis.chatSubmitCount = 0;
    chat.shadowRoot.querySelector('.composer').addEventListener('submit', event => {
      event.preventDefault(); event.stopImmediatePropagation(); chatSubmitCount++;
    }, {capture:true});
    chat.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true}));
    chat.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})); true`)
  assert.equal(await evaluate('chatSubmitCount'), 0)
  await evaluate(`chat.shadowRoot.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); true`)
  assert.equal(await evaluate('chatSubmitCount'), 1)
  await evaluate(`chat.sending = true; await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.send').disabled && chat.shadowRoot.querySelector('textarea').disabled`), true)
  await evaluate(`chat.sending = false; chat.connected = false; await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.send').disabled`), true)
  await evaluate(`chat.connected = true; await chat.updateComplete; true`)
  await click(`chat.shadowRoot.querySelector('[aria-label="Chat settings"]')`)
  await waitFor(`chat.shadowRoot.querySelector('dialog')?.open`)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('dialog input[type=checkbox]').checked`), false)
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('dialog').textContent.includes('verified receipt')`), true)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!chat.shadowRoot.querySelector('dialog')`)
  await resize(390, 844)
  assert.equal(await evaluate(`getComputedStyle(chat.shadowRoot.querySelector('.sidebar')).display`), 'none')
  assert.equal(await evaluate(`chat.shadowRoot.querySelector('.conversation').getBoundingClientRect().width <= innerWidth`), true)
  await click(`chat.shadowRoot.querySelector('[aria-label="Back to conversations"]')`)
  await waitFor(`getComputedStyle(chat.shadowRoot.querySelector('.conversation')).display === 'none'`)
  assert.equal(await evaluate(`getComputedStyle(chat.shadowRoot.querySelector('.sidebar')).display`), 'flex')
  await evaluate(`chat.search = 'Coffee'; await chat.updateComplete; true`)
  assert.equal(await evaluate(`chat.shadowRoot.querySelectorAll('.friend-item').length`), 1)
  await evaluate(`chat.search = ''; await chat.updateComplete;
    chat.shadowRoot.querySelector('.space-item').click(); await chat.updateComplete; true`)
  if (process.env.LFC_UI_SCREENSHOTS) {
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS, 'chat-mobile.png'), Buffer.from(shot.data, 'base64'))
  }
  for (const width of [320, 390, 700, 900, 1280]) {
    await resize(width)
    assert.equal(await evaluate(`chat.shadowRoot.querySelector('.layout').scrollWidth <= innerWidth`), true, `No horizontal overflow at ${width}px`)
    assert.equal(await evaluate(`chat.shadowRoot.querySelector('.composer').getBoundingClientRect().bottom <= innerHeight`), true)
  }
  // Also verify the real shell's header/footer layout, without requesting a signer.
  await evaluate(`
    globalThis.chatFixtureState = {friends:chat.friends,devices:chat.devices,spaces:chat.spaces,messages:chat.messages};
    chat.remove(); shell.style.display = '';
    globalThis.identityController = {signer:async()=>{throw new Error('No signing in this UI fixture')}};
    location.hash = '#!/chat'; true;
  `)
  await waitFor(`shell.shadowRoot.querySelector('chat-view')?.status === 'Chat could not connect.'`)
  await evaluate(`globalThis.chat = shell.shadowRoot.querySelector('chat-view');
    Object.assign(chat,chatFixtureState,{connected:true,error:'',device:{account:'fixture-me',peerId:'fixture-own-peer',deviceId:'fixture-self',certificate:chatFixtureState.spaces[0].manifest.authority}});
    await chat.updateComplete; chat.shadowRoot.querySelector('.space-item').click(); await chat.updateComplete; true;`)
  for (const [width, name] of [[1280, 'desktop'], [390, 'mobile']]) {
    await resize(width, 900)
    const bounds = await evaluate(`(() => {
      const page = chat.getBoundingClientRect(), composer = chat.shadowRoot.querySelector('.composer').getBoundingClientRect();
      return { overflow: chat.shadowRoot.querySelector('.layout').scrollWidth > page.width,
        bottom: composer.bottom, pageBottom: page.bottom, viewport: innerHeight };
    })()`)
    assert.equal(bounds.overflow, false)
    assert.ok(bounds.bottom <= bounds.pageBottom && bounds.pageBottom <= bounds.viewport)
    if (process.env.LFC_UI_SCREENSHOTS) {
      const shot = await call('Page.captureScreenshot', {format:'png'})
      await writeFile(join(process.env.LFC_UI_SCREENSHOTS, `chat-shell-${name}.png`), Buffer.from(shot.data, 'base64'))
    }
  }
  assert.deepEqual(errors, [])
})

async function createShellFixture(t) {
  const root = resolve('www')
  const fixture = new URL('./shell-ui-fixture.html', import.meta.url)
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname
      const path = resolve(root, pathname.slice(1))
      if (pathname !== '/' && !path.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
      }
      const content = await readFile(pathname === '/' ? fixture : path)
      response.setHeader('Content-Type', pathname === '/' ? 'text/html' : {
        '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'
      }[extname(path)] || 'application/octet-stream')
      response.end(content)
    } catch { response.writeHead(404).end() }
  }).listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const profile = await mkdtemp(join(tmpdir(), 'leofcoin-shell-ui-'))
  const chrome = spawn(process.env.CHROME_BIN, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  t.after(async () => {
    if (chrome.exitCode === null) {
      chrome.kill()
      await once(chrome, 'exit')
    }
    await rm(profile, { recursive: true, force: true })
  })
  const endpoint = await new Promise((accept, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('Chrome did not start')), 10000)
    chrome.on('error', error => { clearTimeout(timeout); reject(error) })
    chrome.stderr.on('data', chunk => {
      output += chunk
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timeout); accept(match[1]) }
    })
  })
  const targets = await (await fetch(`${endpoint.replace('ws:', 'http:').split('/devtools/')[0]}/json/list`)).json()
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await once(socket, 'open')
  t.after(() => socket.close())
  let nextId = 0
  const pending = new Map()
  const errors = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.accept(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  })
  const call = (method, params = {}) => new Promise((accept, reject) => {
    const id = ++nextId
    pending.set(id, { accept, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return
      await new Promise(accept => setTimeout(accept, 30))
    }
    throw new Error(`Timed out: ${expression}`)
  }
  const resize = async (width, height = 900) => {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  }
  const click = async expression => {
    const { x, y } = await evaluate(`(() => {
      const rect = (${expression}).getBoundingClientRect()
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    })()`)
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  }
  await call('Runtime.enable')
  await resize(1280)
  await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
  await waitFor(`globalThis.fixtureReady && shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-send')?.shadowRoot`)
  const newTab = async () => {
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' })
    const list = await (await fetch(`${endpoint.replace('ws:', 'http:').split('/devtools/')[0]}/json/list`)).json()
    const other = new WebSocket(list.find(target => target.id === targetId).webSocketDebuggerUrl)
    await once(other, 'open')
    t.after(() => other.close())
    const requests = new Map(); let id = 0
    other.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const task = requests.get(message.id); requests.delete(message.id)
        if (task) message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result)
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    })
    const invoke = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id; requests.set(requestId, { resolve, reject }); other.send(JSON.stringify({ id: requestId, method, params }))
    })
    const evaluateOther = async expression => {
      const result = await invoke('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, replMode: true })
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
      return result.result.value
    }
    await invoke('Runtime.enable')
    await invoke('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    for (let i = 0; i < 100; i++) { if (await evaluateOther('Boolean(globalThis.fixtureReady)')) break; await new Promise(resolve => setTimeout(resolve, 30)) }
    assert.equal(await evaluateOther('Boolean(globalThis.fixtureReady)'), true)
    return { evaluate: evaluateOther, call: invoke, close: () => call('Target.closeTarget', { targetId }) }
  }
  return { evaluate, waitFor, resize, click, call, errors, newTab }
}

test('payment links preserve query text and enforce the requested network', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  await evaluate(`location.hash = '#!/wallet/pay?to=recipient&protocol=url&network=leofcoin%3Apeach&amount=10000&description=hallo+test'`)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-pay')?.requestedNetwork === 'leofcoin:peach'`)
  await evaluate(`globalThis.payPage = shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-pay'); await payPage.rendered`)
  assert.equal(await evaluate(`payPage.description`), 'hallo test')
  assert.equal(await evaluate(`payPage.amount`), '10000')
  assert.equal(await evaluate(`payPage.to`), 'recipient')
  assert.equal(await evaluate(`payPage.paymentState`), 'review')
  const note = 'coffee + (test)? * : {value} & café ☕ #!/explorer'
  const query = new URLSearchParams({ to: 'recipient', network: 'leofcoin:mainnet', amount: '1.25', description: note,
    innerHTML: '<img src=x onerror=alert(1)>', paymentState: 'confirmed', wallet: 'fake' })
  await evaluate(`location.hash = ${JSON.stringify(`#!/wallet/pay?${query}`)}`)
  await waitFor(`payPage.requestedNetwork === 'leofcoin:mainnet' && payPage.shadowRoot.querySelector('.network-warning')`)
  assert.equal(await evaluate(`payPage.description`), note)
  assert.equal(await evaluate(`payPage.paymentState`), 'review')
  assert.equal(await evaluate(`payPage.wallet.selectedAccount === shell.wallet.selectedAccount`), true)
  assert.equal(await evaluate(`[...payPage.shadowRoot.querySelectorAll('button')].find(button => button.textContent.trim() === 'Confirm').disabled`), true)
  assert.equal(await evaluate(`payPage.querySelector('img') === null`), true)
  await evaluate(`location.hash = '#!/wallet/pay'`)
  await waitFor(`payPage.to === '' && payPage.requestedNetwork === ''`)
  assert.deepEqual(errors, [])
})

test('payment review is responsive, does not sign previews and signs once on explicit confirmation', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  const account = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
  await evaluate(`
    globalThis.fixtureSignatures = 0; globalThis.fixtureSubmissions = 0;
    chain.nativeToken = ${JSON.stringify(account)};
    chain.createTransaction = async raw => ({ ...raw, nonce: 1, timestamp: 1 });
    globalThis.identityController = { signer: async () => ({ sign: async () => { fixtureSignatures++; return new Uint8Array(67) } }) };
    chain.sendTransaction = async () => { fixtureSubmissions++; return { hash: 'fixture-transaction', wait: new Promise(resolve => { globalThis.finishFixturePayment = resolve }) } };
    location.hash = ${JSON.stringify(`#!/wallet/pay?${new URLSearchParams({ to: account, amount: '1.25', network: 'leofcoin:peach', description: 'Coffee with the team' })}`)};
  `)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-pay')?.preview?.state === 'ready'`)
  await evaluate(`globalThis.payPage = shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-pay'); await payPage.updateComplete`)
  assert.equal(await evaluate('fixtureSignatures'), 0)
  assert.equal(await evaluate('fixtureSubmissions'), 0)
  assert.deepEqual(await evaluate(`[...payPage.shadowRoot.querySelectorAll('footer button')].map(button => button.textContent.trim())`), ['Cancel', 'Confirm'])
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('.wallet-nav') === null`), true)
  await evaluate(`globalThis.fixturePaymentRoute = location.hash; payPage.shadowRoot.querySelector('footer button').click()`)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view').selectedRoute === 'send'`)
  assert.equal(await evaluate('fixtureSignatures'), 0)
  assert.equal(await evaluate('fixtureSubmissions'), 0)
  await evaluate(`location.hash = fixturePaymentRoute`)
  await waitFor(`payPage.preview.state === 'ready' && shell.shadowRoot.querySelector('wallet-view').selectedRoute === 'pay'`)
  await evaluate('await payPage.updateComplete')
  assert.equal(await evaluate(`payPage.shadowRoot.querySelector('.protocol') === null`), true)
  assert.equal(await evaluate(`payPage.shadowRoot.querySelector('hero-element') === null`), true)
  assert.equal(await evaluate(`payPage.shadowRoot.querySelector('main').getBoundingClientRect().width <= 640`), true)
  assert.equal(await evaluate(`payPage.shadowRoot.querySelector('main').getBoundingClientRect().top < 220`), true)
  if (process.env.LFC_UI_SCREENSHOTS) {
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS, 'payment-review-desktop.png'), Buffer.from(shot.data, 'base64'))
  }
  await resize(390, 844)
  await evaluate('await payPage.updateComplete')
  assert.equal(await evaluate(`payPage.scrollWidth <= payPage.clientWidth + 1`), true)
  assert.equal(await evaluate(`payPage.shadowRoot.querySelector('main').scrollWidth <= payPage.clientWidth + 1`), true)
  assert.equal(await evaluate(`(() => {
    const page = payPage.getBoundingClientRect();
    return [...payPage.shadowRoot.querySelectorAll('footer button')].every(button => {
      const rect = button.getBoundingClientRect(); return rect.top >= page.top && rect.bottom <= page.bottom + 1;
    });
  })()`), true, 'Confirm and Cancel remain visible on a small screen')
  if (process.env.LFC_UI_SCREENSHOTS) {
    const shot = await call('Page.captureScreenshot', { format: 'png' })
    await writeFile(join(process.env.LFC_UI_SCREENSHOTS, 'payment-review-mobile.png'), Buffer.from(shot.data, 'base64'))
  }
  await evaluate(`payPage.amount = '2.5'`)
  await waitFor(`payPage.preview.state === 'ready' && payPage.preview.quote.amount === '2.5'`)
  assert.equal(await evaluate('fixtureSignatures'), 0)
  await evaluate(`peernet.connections = {}; payPage.amount = '3'`)
  await waitFor(`payPage.preview.state === 'error'`)
  assert.match(await evaluate('payPage.preview.error'), /connected and synced/)
  assert.equal(await evaluate(`[...payPage.shadowRoot.querySelectorAll('button')].find(button => button.textContent === 'Confirm').disabled`), true)
  await evaluate(`peernet.connections = { fixture: { connected: true } }; payPage.amount = '4'`)
  await waitFor(`payPage.preview.state === 'ready' && payPage.preview.quote.amount === '4.0'`)
  await evaluate(`await payPage.updateComplete; [...payPage.shadowRoot.querySelectorAll('button')].find(button => button.textContent === 'Confirm').scrollIntoView({ block: 'center' })`)
  assert.equal(await evaluate(`[...payPage.shadowRoot.querySelectorAll('button')].find(button => button.textContent === 'Confirm').disabled`), false)
  await click(`[...payPage.shadowRoot.querySelectorAll('button')].find(button => button.textContent === 'Confirm')`)
  await waitFor(`payPage.paymentState === 'submitted' || payPage.paymentState === 'failed'`)
  assert.equal(await evaluate('payPage.paymentState'), 'submitted', await evaluate('payPage.validationError'))
  assert.equal(await evaluate('fixtureSignatures'), 1)
  assert.equal(await evaluate('fixtureSubmissions'), 1)
  await evaluate(`finishFixturePayment('fixture-transaction')`)
  await waitFor(`payPage.paymentState === 'confirmed'`)
  assert.deepEqual(errors, [])
})

test('payment confirmation rejects a node replacement while signing', {
  skip: !runShellUiTests, timeout: 15000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  const account = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
  await evaluate(`globalThis.fixtureSubmissions = 0;
    chain.nativeToken = ${JSON.stringify(account)};
    chain.createTransaction = async raw => ({ ...raw, nonce: 1, timestamp: 1 });
    chain.sendTransaction = async () => { fixtureSubmissions++; throw new Error('Must not submit') };
    globalThis.identityController = { signer: async () => ({ sign: () => new Promise(resolve => { globalThis.finishFixtureSignature = resolve }) }) };
    location.hash = ${JSON.stringify(`#!/wallet/pay?to=${account}&amount=1`)};`)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-pay')?.preview?.state === 'ready'`)
  await evaluate(`globalThis.payPage = shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-pay');
    await payPage.updateComplete; payPage.shadowRoot.querySelector('button.primary').click()`)
  await waitFor(`globalThis.finishFixtureSignature`)
  await evaluate(`globalThis.chain = { ...chain }; finishFixtureSignature(new Uint8Array(67))`)
  await waitFor(`payPage.paymentState === 'failed'`)
  assert.equal(await evaluate('fixtureSubmissions'), 0)
  assert.match(await evaluate('payPage.validationError'), /details changed/)
  assert.deepEqual(errors, [])
})

test('payment recipients can be saved without sending and resolve trusted address-book names', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  const address = 'YTqzdvFjFnk7uX3tA54GaS1FyJXuAqRgnWZESKAsY19FDDDnHRdSN'
  const name = 'Alice <b>team</b>'
  await evaluate(`globalThis.fixtureSignatures = 0; globalThis.fixtureSubmissions = 0;
    chain.nativeToken = ${JSON.stringify(address)};
    chain.createTransaction = async raw => ({ ...raw, nonce: 1, timestamp: 1 });
    globalThis.identityController = { signer: async () => { fixtureSignatures++; throw new Error('Saving a contact must never sign') } };
    chain.sendTransaction = async () => { fixtureSubmissions++; throw new Error('Saving a contact must never send') };
    location.hash = ${JSON.stringify(`#!/wallet/pay?to=${address}&amount=1&name=Untrusted-request-name`)};`)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view')?.shadowRoot?.querySelector('wallet-pay')?.preview?.state === 'ready'`)
  await evaluate(`globalThis.payPage = shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-pay');
    globalThis.recipient = payPage.shadowRoot.querySelector('payment-recipient'); await recipient.updateComplete`)
  assert.equal(await evaluate(`recipient.contact`), null)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('.contact-name')`), null)
  assert.equal(await evaluate(`payPage.shadowRoot.textContent.includes('Balance after payment')`), false)
  assert.equal(await evaluate(`payPage.shadowRoot.textContent.includes('Total, including fee')`), false)
  await evaluate(`recipient.shadowRoot.querySelector('.add-contact').click()`)
  await waitFor(`recipient.shadowRoot.querySelector('dialog').open`)
  await resize(390, 844)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  await evaluate(`recipient.shadowRoot.querySelector('dialog button[type="button"]').click()`)
  assert.equal(await evaluate(`localStorage.getItem('leofcoin:peach:wallet-address-book:v1')`), null)
  await evaluate(`recipient.shadowRoot.querySelector('.add-contact').click()`)
  await waitFor(`recipient.shadowRoot.querySelector('dialog').open`)
  await evaluate(`const input = recipient.shadowRoot.querySelector('input'); input.value = ${JSON.stringify(name)};
    input.dispatchEvent(new Event('input', { bubbles: true })); await recipient.updateComplete;
    recipient.shadowRoot.querySelector('form').requestSubmit()`)
  await waitFor(`recipient.contact?.name === ${JSON.stringify(name)} && !recipient.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('.contact-name').textContent`), name)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('b') === null`), true, 'contact labels are escaped text')
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('details').open`), false)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('.add-contact') === null`), true)
  await evaluate(`recipient.shadowRoot.querySelector('summary').click()`)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('.address').textContent`), address)
  assert.equal(await evaluate('fixtureSignatures'), 0)
  assert.equal(await evaluate('fixtureSubmissions'), 0)
  assert.equal(await evaluate(`localStorage.getItem('leofcoin:mainnet:wallet-address-book:v1')`), null)
  await evaluate(`location.hash = '#!/wallet/send'`)
  await waitFor(`shell.shadowRoot.querySelector('wallet-view').selectedRoute === 'send'`)
  await evaluate(`globalThis.sendPage = shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-send');
    sendPage.to = ${JSON.stringify(address)}; sendPage.amount = '2'; await sendPage.updateComplete;
    sendPage.shadowRoot.querySelector('.review-button').click()`)
  await waitFor(`sendPage.phase === 'review' && sendPage.shadowRoot.querySelector('payment-recipient')?.contact?.name === ${JSON.stringify(name)}`)
  assert.equal(await evaluate('fixtureSignatures'), 0)
  await evaluate(`location.hash = ${JSON.stringify(`#!/wallet/pay?to=${address}&amount=1`)}`)
  await waitFor(`payPage.isConnected && payPage.shadowRoot.querySelector('payment-recipient')?.contact?.name === ${JSON.stringify(name)}`)
  await evaluate(`globalThis.recipient = payPage.shadowRoot.querySelector('payment-recipient');
    localStorage.setItem('leofcoin:peach:wallet-address-book:v1', '{');
    window.dispatchEvent(new StorageEvent('storage', { key: 'leofcoin:peach:wallet-address-book:v1' }))`)
  await waitFor(`recipient.error && !recipient.contact`)
  assert.equal(await evaluate(`recipient.shadowRoot.querySelector('.add-contact').disabled`), true)
  assert.deepEqual(errors, [])
})

test('two real browser tabs share one main runtime and closing the main tab hands ownership to the follower', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, call, newTab, errors } = await createShellFixture(t)
  const setup = `
    globalThis.tabStarts = 0;
    globalThis.tabsModule = await import('/browser-node-tabs.js');
    globalThis.followerModule = await import('/browser-node-follower.js');
    globalThis.routingModule = await import('/chain/routing-identity-browser.js');
    globalThis.sharedTabs = tabsModule.createBrowserNodeTabs({ network: 'leofcoin:ui-shared-fixture', heartbeatMs: 50,
      onFollower: session => {
        globalThis.followerAdapter ||= followerModule.createBrowserNodeFollower(session, { account: () => shell.wallet.selectedAccount });
        followerAdapter.install();
      },
      start: async () => {
        globalThis.followerAdapter?.uninstall();
        tabStarts++;
        const routing = await routingModule.browserRoutingId({ network: 'leofcoin:ui-shared-fixture', routingAccount: shell.wallet.selectedAccount });
        globalThis.chain = { version: '0.5.0', nativeToken: 'fixture-token', state: { chain: 'loaded', sync: 'synced' },
          lastBlock: { index: 20n, hash: 'fixture-tip' }, balanceOf: async () => 77n };
        globalThis.peernet = { id: routing, peerId: 'fixture-wallet-peer', selectedAccount: shell.wallet.selectedAccount,
          connections: { fixture: { connected: true, version: '0.5.0' } }, subscribe: async () => {} };
        return { chain, peernet, stores: {} };
      }
    }); await sharedTabs.ready; true;`
  await evaluate(setup)
  const routing = await evaluate('sharedTabs.status.routingPeer')
  assert.equal(await evaluate('tabStarts'), 1)
  const other = await newTab()
  await other.evaluate(setup)
  assert.equal(await other.evaluate('sharedTabs.role'), 'follower')
  assert.equal(await other.evaluate('tabStarts'), 0, 'following tab does not start workers or P2P runtime')
  assert.equal(await other.evaluate('String(await chain.balanceOf(shell.wallet.selectedAccount))'), '77')
  assert.equal(await other.evaluate('peernet.id'), routing)
  const { targetInfo } = await call('Target.getTargetInfo')
  await other.call('Target.closeTarget', { targetId: targetInfo.targetId })
  for (let i = 0; i < 100; i++) {
    if (await other.evaluate('sharedTabs.role === "leader" && sharedTabs.available && tabStarts === 1')) break
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  assert.equal(await other.evaluate('sharedTabs.role'), 'leader')
  assert.equal(await other.evaluate('tabStarts'), 1)
  assert.equal(await other.evaluate('sharedTabs.status.routingPeer'), routing, 'same account keeps its routing ID after handoff')
  assert.deepEqual(errors, [])
})

test('browser routing identity is shared by account across tabs and survives reload without touching the wallet', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, call, errors } = await createShellFixture(t)
  const wallet = await evaluate('shell.wallet.selectedAccount')
  await evaluate(`globalThis.routingModule = await import('/chain/routing-identity-browser.js');
    globalThis.firstRouting = routingModule.createBrowserRoutingIdentity();
    globalThis.routingConfig = { network: 'leofcoin:peach', routingAccount: shell.wallet.selectedAccount };
    globalThis.firstRoutingId = await firstRouting(routingConfig);
    globalThis.secondRoutingId = await routingModule.createBrowserRoutingIdentity()(routingConfig);`)
  const first = await evaluate('firstRoutingId'), second = await evaluate('secondRoutingId')
  assert.match(first, /^lfc-peer-[a-f0-9]{32}$/)
  assert.equal(first, second, 'tabs of one account share the main node’s routing ID')
  assert.equal(await evaluate('await firstRouting(routingConfig)'), first)
  assert.equal(await evaluate('shell.wallet.selectedAccount'), wallet)
  const previousDocument = await evaluate('performance.timeOrigin')
  await call('Page.reload')
  await waitFor(`performance.timeOrigin !== ${previousDocument} && globalThis.fixtureReady`)
  await evaluate(`globalThis.routingModule = await import('/chain/routing-identity-browser.js');
    globalThis.reloadedRoutingId = await routingModule.browserRoutingId({ network: 'leofcoin:peach', routingAccount: shell.wallet.selectedAccount });`)
  assert.equal(await evaluate('reloadedRoutingId'), second, 'reload reuses the account’s persisted ID')
  assert.equal(await evaluate('shell.wallet.selectedAccount'), wallet)
  assert.deepEqual(errors, [])
})

test('settings storage management confirms, reloads, clears real OPFS chain data and preserves the wallet', {
  skip: !runShellUiTests, timeout: 20000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  await evaluate(`globalThis.FixtureStorage = (await import('/storage.js')).default;
    for (const name of ['block-peach', 'state-peach', 'chain-peach', 'transactionPool-peach', 'block-mainnet', 'wallet']) {
      const store = new FixtureStorage(name); await store.init(); await store.put('fixture-record', new Uint8Array([7, 8, 9]));
      if (name === 'wallet') await store.put('identity', new Uint8Array([42, 43]));
    }
    localStorage.setItem('leofcoin:peach:wallet-address-book:v1', JSON.stringify({ version: 1, contacts: [] }));
    shell.wallet = undefined; location.hash = '#!/settings?action=chain&confirm=DELETE%20BLOCKS';`)
  await waitFor(`shell.currentRoute === 'settings' && shell.shadowRoot.querySelector('settings-view')?.overview`)
  await evaluate(`globalThis.settings = shell.shadowRoot.querySelector('settings-view'); await settings.updateComplete`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('login-screen') === null`), true)
  assert.equal(await evaluate('settings.action'), '', 'URL parameters cannot schedule deletion')
  assert.equal(await evaluate(`settings.overview.stores.find(store => store.name === 'block-peach').count`), 1)
  assert.equal(await evaluate(`settings.overview.stores.find(store => store.name === 'block-peach').bytes`), 3)
  assert.equal(await evaluate('settings.overview.bytes'), 12)
  assert.equal(await evaluate(`settings.shadowRoot.textContent.includes('Memory & processing')`), true)
  assert.equal(await evaluate(`settings.shadowRoot.querySelector('[data-action="memory"]').disabled`), true, 'Non-isolated fixture cannot measure app memory')
  for (const width of [1280, 390]) {
    await resize(width)
    assert.equal(await evaluate('settings.scrollWidth <= settings.clientWidth + 1'), true)
    if (process.env.LFC_UI_SCREENSHOTS) {
      const shot = await call('Page.captureScreenshot', { format: 'png' })
      await writeFile(join(process.env.LFC_UI_SCREENSHOTS, `settings-${width}.png`), Buffer.from(shot.data, 'base64'))
    }
  }
  // Simulated API samples verify UI behavior; the real fixture is not isolated
  // and cannot provide an actual application-memory measurement.
  await evaluate(`globalThis.originalIsolation = Object.getOwnPropertyDescriptor(globalThis, 'crossOriginIsolated');
    globalThis.originalMemory = Object.getOwnPropertyDescriptor(performance, 'measureUserAgentSpecificMemory');
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: true });
    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', { configurable: true, value: async () => ({ bytes: 42 * 1024 ** 2 }) });
    settings.requestUpdate(); await settings.updateComplete;
    settings.shadowRoot.querySelector('[data-action="memory"]').click()`)
  await waitFor('settings.memoryBytes === 42 * 1024 ** 2 && !settings.measuring')
  assert.equal(await evaluate(`settings.shadowRoot.textContent.includes('42.0 MB')`), true)
  await evaluate(`Object.defineProperty(performance, 'measureUserAgentSpecificMemory', { configurable: true, value: async () => { throw new Error('Measurement denied') } });
    settings.shadowRoot.querySelector('[data-action="memory"]').click()`)
  await waitFor(`settings.memoryError === 'Measurement denied' && !settings.measuring`)
  assert.equal(await evaluate('settings.memoryBytes'), 42 * 1024 ** 2, 'Failed refresh retains the labeled previous sample')
  await evaluate(`if (originalIsolation) Object.defineProperty(globalThis, 'crossOriginIsolated', originalIsolation); else delete globalThis.crossOriginIsolated;
    if (originalMemory) Object.defineProperty(performance, 'measureUserAgentSpecificMemory', originalMemory); else delete performance.measureUserAgentSpecificMemory;
    settings.requestUpdate(); await settings.updateComplete;`)
  await evaluate(`settings.shadowRoot.querySelector('[data-action="chain"]').click()`)
  await waitFor(`settings.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`settings.shadowRoot.querySelector('button[type="submit"]').disabled`), true)
  await evaluate(`const input = settings.shadowRoot.querySelector('input'); input.value = 'DELETE'; input.dispatchEvent(new Event('input'));
    await settings.updateComplete; settings.shadowRoot.querySelector('form').requestSubmit()`)
  assert.equal(await evaluate(`sessionStorage.getItem('leofcoin:storage-request:v1')`), null)
  await evaluate(`settings.shadowRoot.querySelector('dialog button[type="button"]').click()`)
  assert.equal(await evaluate(`settings.shadowRoot.querySelector('dialog').open`), false)
  await evaluate(`settings.shadowRoot.querySelector('[data-action="chain"]').click()`)
  await waitFor(`settings.shadowRoot.querySelector('dialog').open`)
  const previousDocument = await evaluate('performance.timeOrigin')
  await evaluate(`settings.confirmation = 'DELETE BLOCKS'; await settings.updateComplete;
    settings.shadowRoot.querySelector('form').requestSubmit()`)
  await waitFor(`performance.timeOrigin !== ${previousDocument} && globalThis.fixtureReady && globalThis.shell?.currentRoute === 'wallet' &&
    sessionStorage.getItem('leofcoin:storage-request:v1') === null && localStorage.getItem('leofcoin:storage-incomplete:v1') === null`)
  const records = JSON.parse(await evaluate(`
    globalThis.StorageCheck = (await import('/storage.js')).default;
    globalThis.checkedRecords = {};
    for (const name of ['block-peach', 'state-peach', 'chain-peach', 'transactionPool-peach', 'block-mainnet', 'wallet']) {
      const store = new StorageCheck(name); await store.init(); checkedRecords[name] = await store.keys();
    }
    const checkedWallet = new StorageCheck('wallet'); await checkedWallet.init(); checkedRecords.walletValue = [...await checkedWallet.get('fixture-record')];
    checkedRecords.identityValue = [...await checkedWallet.get('identity')];
    JSON.stringify(checkedRecords);
  `))
  for (const name of ['block-peach', 'state-peach', 'chain-peach', 'transactionPool-peach']) assert.deepEqual(records[name], [], JSON.stringify(records))
  assert.deepEqual(records['block-mainnet'], ['fixture-record'])
  assert.deepEqual(records.wallet.sort(), ['fixture-record', 'identity'])
  assert.deepEqual(records.walletValue, [7, 8, 9])
  assert.deepEqual(records.identityValue, [42, 43])
  assert.equal(await evaluate(`Boolean(localStorage.getItem('leofcoin:peach:wallet-address-book:v1'))`), true)
  assert.deepEqual(errors, [])
})

test('removed manager route returns to wallet without loading a manager view', {
  skip: !runShellUiTests, timeout: 15000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  await evaluate(`location.hash = '#!/manager'`)
  await waitFor(`location.hash === '#!/wallet' && shell.currentRoute === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('manager-view') === null`), true)
  assert.equal(await evaluate(`shell.notificationController.entries.some(entry =>
    entry.message === 'Chain manager is now a separate app.')`), true)
  assert.deepEqual(errors, [])
})

test('responsive shell, wallet navigation and notification lifecycle', {
  skip: !runShellUiTests, timeout: 45000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.isDesktop`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelectorAll('.primary-nav a').length`), 10)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('account-select').networkKey`), 'peach')
  await evaluate(`globalThis.originalConfirm = window.confirm;
    window.confirm = message => { window.networkSwitchPrompt = message; return false };
    shell.shadowRoot.querySelector('account-select').dispatchEvent(new CustomEvent('network-change', { detail: { key: 'mainnet' }, bubbles: true, composed: true }));
    window.confirm = originalConfirm`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('account-select').networkKey`), 'peach')
  assert.equal(await evaluate(`window.networkSwitchPrompt.includes('pending transactions')`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[aria-current="page"]').dataset.route`), 'wallet')
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('login-screen')`), true)
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('export-screen')`), true)
  assert.equal(await evaluate(`!shell.shadowRoot.querySelector('sync-info')`), true)
  assert.equal(await evaluate(`getComputedStyle(shell.shadowRoot.querySelector('.menu-toggle')).display`), 'none')
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').children.length`), 1)
  await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info')?.open`)
  await evaluate(`globalThis.cachedSyncInfo = shell.shadowRoot.querySelector('sync-info');
    cachedSyncInfo.shadowRoot.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }))`)
  await waitFor(`!shell.shadowRoot.querySelector('sync-info')`)
  await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info') === cachedSyncInfo && cachedSyncInfo.open`)
  await waitFor(`cachedSyncInfo.shadowRoot.querySelector('dialog').open`)
  await evaluate(`cachedSyncInfo.shadowRoot.querySelector('dialog').dispatchEvent(new Event('close')); await cachedSyncInfo.updateComplete`)
  assert.equal(await evaluate('cachedSyncInfo.open'), true, 'a stale queued close cannot dismiss a reopened drawer')
  await evaluate(`cachedSyncInfo.shadowRoot.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }))`)
  await waitFor(`!shell.shadowRoot.querySelector('sync-info')`)
  await evaluate(`globalThis.fixtureWallet = shell.wallet;
    shell.wallet = undefined;
    shell.currentRoute = 'identity';
    shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.cachedLoginScreen = shell.shadowRoot.querySelector('login-screen');
    shell.currentRoute = 'stats'; shell.loginOpen = false`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.currentRoute = 'identity'; shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`cachedLoginScreen.setAttribute('shown', '');
    shell.wallet = fixtureWallet;
    await shell.select('identity')`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`cachedLoginScreen.shadowRoot.querySelector('input').focus()`)
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement === cachedLoginScreen.shadowRoot.querySelector('input')`),
    true
  )
  await evaluate(`cachedLoginScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement !== cachedLoginScreen.shadowRoot.querySelector('input')`),
    true
  )
  await evaluate(`shell.wallet = fixtureWallet;
    shell.currentRoute = 'wallet'`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`shell.passwordPromptOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen') === cachedLoginScreen`)
  await evaluate(`globalThis.backupPasswordRequest = cachedLoginScreen.requestPassword()`)
  await waitFor(`cachedLoginScreen.shadowRoot.activeElement === cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input')`)
  await evaluate(`const backupInput = cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input');
    backupInput.value = 'test-backup-password';
    cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] button').click()`)
  assert.equal(await evaluate(`await globalThis.backupPasswordRequest`), 'test-backup-password')
  assert.equal(
    await evaluate(`cachedLoginScreen.shadowRoot.activeElement !== cachedLoginScreen.shadowRoot.querySelector('[data-route="backup"] input')`),
    true
  )
  await evaluate(`shell.passwordPromptOpen = false`)
  await waitFor(`!shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view');
    globalThis.cachedSendView = walletView.shadowRoot.querySelector('wallet-send');
    await walletView.select('receive')`)
  await waitFor(`walletView.selectedRoute === 'receive' && walletView.pages.children.length === 1`)
  await evaluate(`await walletView.select('send')`)
  await waitFor(`walletView.selectedRoute === 'send' && walletView.pages.children.length === 1`)
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('wallet-send') === cachedSendView`), true)
  await evaluate(`await shell.select('identity')`)
  await waitFor(`shell.currentRoute === 'identity' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'identity'`)
  await evaluate(`globalThis.identityView = shell.shadowRoot.querySelector('identity-view');
    await identityView.select('accounts')`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.pages.children.length === 1`)
  await evaluate(`globalThis.cachedAccountsView = identityView.shadowRoot.querySelector('identity-accounts');
    await identityView.select('dashboard');
    await identityView.select('accounts')`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.shadowRoot.querySelector('identity-accounts') === cachedAccountsView`)
  await evaluate(`await shell.select('wallet')`)
  await waitFor(`shell.currentRoute === 'wallet'`)
  await evaluate(`shell.showExport('data:image/png;base64,', 'fixture backup')`)
  await waitFor(`shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`globalThis.cachedExportScreen = shell.shadowRoot.querySelector('export-screen');
    cachedExportScreen.click()`)
  await waitFor(`!shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`shell.showExport('data:image/png;base64,', 'fixture backup')`)
  await waitFor(`shell.shadowRoot.querySelector('export-screen') === cachedExportScreen`)
  await evaluate(`cachedExportScreen.click()`)
  await waitFor(`!shell.shadowRoot.querySelector('export-screen')`)
  await evaluate(`globalThis.initialWalletView = walletView;
    await shell.select('stats')`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'stats'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').children.length`), 1)
  await evaluate(`await shell.select('wallet')`)
  await waitFor(`shell.currentRoute === 'wallet' && shell.shadowRoot.querySelector('#main-content').querySelector('.custom-selected')?.dataset.route === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-view') === initialWalletView`), true)

  await resize(390)
  await waitFor(`!shell.isDesktop`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen && shell.shadowRoot.querySelector('.main').inert`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.dataset.route`), 'wallet')
  await evaluate(`shell.shadowRoot.querySelector('.drawer-close').focus()`)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', modifiers: 8 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', modifiers: 8 })
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.classList.contains('network-card')`), true)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.classList.contains('menu-toggle')`), true)
  await evaluate(`shell.shadowRoot.querySelector('.menu-toggle').click()`)
  await waitFor(`shell.drawerOpen`)
  await resize(1100)
  await waitFor(`shell.isDesktop && !shell.drawerOpen`)
  await resize(390)
  await waitFor(`!shell.isDesktop`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('#app-navigation').inert`), true)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await evaluate(`shell.shadowRoot.querySelector('.drawer-backdrop').click()`)
  await waitFor(`!shell.drawerOpen`)

  await evaluate(`globalThis.account = shell.shadowRoot.querySelector('account-select');
    account.shadowRoot.querySelector('.trigger').click()`)
  await waitFor(`account.selecting`)
  assert.equal(await evaluate(`account.shadowRoot.querySelector('.menu').getBoundingClientRect().right <= innerWidth`), true)
  await evaluate(`account.shadowRoot.querySelector('.trigger').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`)
  await waitFor(`!account.selecting`)

  await evaluate(`globalThis.notices = shell.notificationController;
    notices.createNotification({ title: 'Dismiss early', message: 'No timer exception' }, 250);
    notices.createNotification({ title: 'Persistent', message: 'Saved in session', type: 'warning' }, 0);`)
  await waitFor(`notices.shadowRoot.querySelectorAll('.recents notification-child').length === 2`)
  await evaluate(`notices.shadowRoot.querySelectorAll('.recents notification-child')[1].shadowRoot.querySelector('button').click()`)
  await new Promise(accept => setTimeout(accept, 300))
  assert.equal(await evaluate(`notices.entries.length`), 1)
  await evaluate(`notices.createNotification({ title: 'Pause', message: 'Readable long message' }, 100)`)
  await waitFor(`notices.entries.length === 2`)
  await evaluate(`notices.shadowRoot.querySelector('.recents notification-child').shadowRoot.querySelector('article').dispatchEvent(new Event('pointerenter'))`)
  await new Promise(accept => setTimeout(accept, 150))
  assert.equal(await evaluate(`notices.entries[0].recent`), true)
  await evaluate(`notices.shadowRoot.querySelector('.recents notification-child').shadowRoot.querySelector('article').dispatchEvent(new Event('pointerleave'))`)
  await waitFor(`!notices.entries[0].recent`)
  assert.equal(await evaluate(`notices.unread`), 2)
  await evaluate(`shell.shadowRoot.querySelector('.notification-toggle').focus(); shell.shadowRoot.querySelector('.notification-toggle').click()`)
  await waitFor(`notices.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`notices.unread`), 0)
  assert.equal(await evaluate(`notices.shadowRoot.querySelectorAll('.list notification-child').length`), 2)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!notices.open && !shell.notificationsOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.activeElement.classList.contains('notification-toggle')`), true)
  await evaluate(`shell.shadowRoot.querySelector('.notification-toggle').click()`)
  await waitFor(`notices.open`)
  await evaluate(`notices.shadowRoot.querySelector('footer button').click()`)
  await waitFor(`notices.entries.length === 0`)
  assert.equal(await evaluate(`notices.shadowRoot.querySelector('.empty strong').textContent`), "You're all caught up")
  await evaluate(`notices.shadowRoot.querySelector('.close').click()`)
  await waitFor(`!notices.open`)

  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view'); undefined`)
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/receive"]')`)
  await waitFor(`walletView.selectedRoute === 'receive' && walletView.shadowRoot.querySelector('wallet-receive')?.shadowRoot?.querySelector('input')`)
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('a[aria-current="page"]').textContent.trim()`), 'Receive')
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('wallet-receive').shadowRoot.querySelectorAll('label input').length`), 2)
  await evaluate(`location.hash = '#!/wallet/pay'`)
  await waitFor(`walletView.selectedRoute === 'pay' && walletView.shadowRoot.querySelector('wallet-pay')?.shadowRoot?.querySelector('textarea')`)
  assert.equal(await evaluate(`shell.pages.style.position`), '')
  assert.equal(await evaluate(`walletView.shadowRoot.querySelector('.wallet-nav') === null`), true)
  await click(`[...walletView.shadowRoot.querySelector('wallet-pay').shadowRoot.querySelectorAll('button')].find(button => button.textContent === 'Cancel')`)
  await waitFor(`walletView.selectedRoute === 'send'`)
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/transactions"]')`)
  await waitFor(`walletView.selectedRoute === 'transactions'`)
  assert.equal(await evaluate(`shell.pages.style.position`), '')
  await click(`walletView.shadowRoot.querySelector('a[href="#!/wallet/send"]')`)
  await waitFor(`walletView.selectedRoute === 'send'`)
  for (const width of [320, 390, 768, 1280]) {
    await resize(width)
    await waitFor(`innerWidth === ${width}`)
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, `document overflow at ${width}px`)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('header').scrollWidth <= shell.shadowRoot.querySelector('header').clientWidth`), true, `header overflow at ${width}px`)
    assert.equal(await evaluate(`walletView.shadowRoot.querySelector('nav').getBoundingClientRect().right <= innerWidth`), true, `wallet navigation overflow at ${width}px`)
  }
  await click(`shell.shadowRoot.querySelector('.notification-toggle')`)
  await waitFor(`notices.open`)
  assert.equal(await evaluate(`notices.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  await click(`notices.shadowRoot.querySelector('.close')`)
  await waitFor(`!notices.open`)
  assert.deepEqual(errors, [])
})

test('wallet-required views automatically open the unlock dialog and preserve deep links', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, errors } = await createShellFixture(t)
  await evaluate(`globalThis.lockedFixtureWallet = shell.wallet; shell.wallet = undefined;
    globalThis.walletStore = { has: async () => true }; location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats'`)
  for (const route of ['wallet/send', 'identity/accounts', 'chat', 'validator', 'faucet']) {
    await evaluate(`location.hash = '#!/${route}'`)
    await waitFor(`shell.currentRoute === '${route.split('/')[0]}' && shell.shadowRoot.querySelector('login-screen')?.shown`)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-required') === null`), true)
    assert.equal(await evaluate(`shell.shadowRoot.querySelector('#main-content').querySelector('${route.split('/')[0]}-view') === null`), true)
  }
  await evaluate(`location.hash = '#!/identity/accounts'`)
  await waitFor(`shell.currentRoute === 'identity'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')?.shown`)
  await evaluate(`globalThis.unlockScreen = shell.shadowRoot.querySelector('login-screen');
    unlockScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`!shell.loginOpen`)
  await evaluate(`location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('login-screen') === null`), true)
  await evaluate(`location.hash = '#!/identity/accounts'`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')?.shown`)
  await evaluate(`shell.wallet = lockedFixtureWallet;
    unlockScreen.shown = false;
    unlockScreen.dispatchEvent(new CustomEvent('login-dismiss', { bubbles: true, composed: true }))`)
  await waitFor(`shell.shadowRoot.querySelector('identity-view')?.selectedRoute === 'accounts'`)
  assert.equal(await evaluate(`location.hash`), '#!/identity/accounts')
  await evaluate(`shell.wallet = undefined; location.hash = '#!/stats'`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('stats-view')`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-required') === null`), true)
  assert.deepEqual(errors, [])
})

test('wallet creation keeps both backup actions and confirmation reachable', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, click, errors } = await createShellFixture(t)
  await resize(604, 536)
  await evaluate(`globalThis.fixtureWalletData = new Map();
    globalThis.walletStore = {
      has: async key => fixtureWalletData.has(key),
      put: async (key, value) => fixtureWalletData.set(key, value),
      get: async key => fixtureWalletData.get(key)
    };
    shell.loginOpen = true`)
  await waitFor(`shell.shadowRoot.querySelector('login-screen')`)
  await evaluate(`globalThis.backupScreen = shell.shadowRoot.querySelector('login-screen');
    void backupScreen.requestLogin(false)`)
  await waitFor(`backupScreen.headline === 'Welcome!'`)
  await evaluate(`await backupScreen.requestRender();
    backupScreen.shadowRoot.querySelector('.wallet-password').value = 'fixture-backup-password'`)
  await click(`backupScreen.shadowRoot.querySelector('[data-route-action="create"]')`)
  await waitFor(`!backupScreen.busy && (backupScreen.shadowRoot.querySelector('[data-route="create"]').classList.contains('custom-selected') || backupScreen.loginError)`)
  assert.equal(await evaluate(`backupScreen.loginError`), '')
  await waitFor(`backupScreen.shadowRoot.querySelector('[data-route="create"]').classList.contains('custom-selected')`)
  assert.equal(await evaluate(`backupScreen.shadowRoot.querySelector('hero-element').shadowRoot.querySelector('custom-typography[type="headline"], custom-typography[type="subline"]') === null`), true)

  for (const [width, height] of [[604, 536], [390, 420], [320, 568], [1280, 900]]) {
    await resize(width, height)
    for (const selector of ['button.backup-action', 'flex-row:nth-of-type(2) button.backup-action', 'button.backup-confirm']) {
      // Check every clipping ancestor, not just the taller create section.
      assert.equal(await evaluate(`(() => {
        const create = backupScreen.shadowRoot.querySelector('[data-route="create"]');
        const button = create.querySelector('${selector}');
        button.scrollIntoView({ block: 'center' });
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight &&
          [...backupScreen.shadowRoot.querySelectorAll('hero-element, custom-pages, [data-route="create"]')]
            .every(ancestor => {
              if (getComputedStyle(ancestor).overflowY === 'visible') return true;
              const bounds = ancestor.getBoundingClientRect();
              return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
            });
      })()`), true, `${selector} must be reachable at ${width}x${height}`)
    }
  }
  await resize(604, 536)
  assert.equal(await evaluate(`backupScreen.shadowRoot.querySelector('button.backup-confirm').disabled`), true)
  await evaluate(`backupScreen.shadowRoot.querySelector('button.backup-action').scrollIntoView({ block: 'center' })`)
  await click(`backupScreen.shadowRoot.querySelector('[data-route="create"] button.backup-action')`)
  await waitFor(`document.querySelector('dialog[data-wallet-backup="recovery-phrase"]')?.open`)
  await evaluate(`const phraseDialog = document.querySelector('dialog[data-wallet-backup="recovery-phrase"]');
    const phrase = phraseDialog.querySelector('flex-wrap-between');
    phrase.scrollTop = phrase.scrollHeight`)
  await click(`document.querySelector('dialog[data-wallet-backup="recovery-phrase"] button')`)
  await waitFor(`!document.querySelector('dialog[data-wallet-backup="recovery-phrase"]')`)
  assert.equal(await evaluate(`backupScreen.shadowRoot.querySelector('[data-route="create"] .step-marker').hasAttribute('data-complete')`), true)
  assert.equal(await evaluate(`backupScreen.shadowRoot.querySelector('button.backup-confirm').disabled`), true)
  await evaluate(`backupScreen.shadowRoot.querySelectorAll('button.backup-action')[1].scrollIntoView({ block: 'center' })`)
  await click(`backupScreen.shadowRoot.querySelectorAll('button.backup-action')[1]`)
  await waitFor(`document.querySelector('dialog[data-wallet-backup="password"]')?.open`)
  assert.equal(await evaluate(`document.querySelector('dialog[data-wallet-backup="password"] p').textContent === 'fixture-backup-password'`), true)
  await click(`document.querySelector('dialog[data-wallet-backup="password"] button')`)
  await waitFor(`!document.querySelector('dialog[data-wallet-backup="password"]')`)
  await waitFor(`!backupScreen.shadowRoot.querySelector('button.backup-confirm').disabled`)
  await evaluate(`backupScreen.shadowRoot.querySelector('button.backup-confirm').scrollIntoView({ block: 'center' })`)
  await click(`backupScreen.shadowRoot.querySelector('button.backup-confirm')`)
  await waitFor(`!backupScreen.shown && !shell.loginOpen`)
  assert.deepEqual(errors, [])
})

test('faucet has its own testnet-only route and never mounts on mainnet', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('aside testnet-faucet') === null`), true)
  await evaluate(`globalThis.faucetReads = 0; globalThis.originalFaucetFetch = fetch;
    globalThis.fetch = async (url, options) => {
      if (String(url).endsWith('/status')) {
        faucetReads++;
        return new Response(new Uint8Array(${JSON.stringify([...encodeWire('rpc', { network: 'leofcoin:peach', testnet: true, ready: true, amount: '10' })])}),
          { headers: { 'Content-Type': ${JSON.stringify(BINARY_CONTENT_TYPE)} } });
      }
      return originalFaucetFetch(url, options);
    };
    shell.shadowRoot.querySelector('a[data-route="faucet"]').click()`)
  await waitFor(`shell.currentRoute === 'faucet' && shell.shadowRoot.querySelector('faucet-view')?.shadowRoot?.querySelector('testnet-faucet')?.info?.ready`)
  assert.equal(await evaluate(`location.hash`), '#!/faucet')
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet').address === shell.wallet.selectedAccount`), true)
  await evaluate(`shell.wallet = { ...shell.wallet, selectedAccount: 'updated-testnet-address' }`)
  await waitFor(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet').address === 'updated-testnet-address'`)
  for (const width of [1280, 320]) {
    await resize(width)
    assert.equal(await evaluate(`(() => { const view = shell.shadowRoot.querySelector('faucet-view'); return view.scrollWidth <= view.clientWidth })()`), true)
  }
  await evaluate(`const view = shell.shadowRoot.querySelector('faucet-view'); view.wallet = undefined; await view.updateComplete`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('faucet-view').shadowRoot.querySelector('testnet-faucet') === null`), true)
  await evaluate(`await shell.select('wallet');
    localStorage.setItem('leofcoin:selected-network:v1', 'mainnet');
    shell.selectedNetworkKey = 'mainnet'; await shell.rendered;
    globalThis.readsBeforeMainnet = faucetReads;
    location.hash = '#!/faucet'`)
  await waitFor(`location.hash === '#!/wallet' && shell.currentRoute === 'wallet'`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[data-route="faucet"]') === null`), true)
  await evaluate(`globalThis.mainnetFaucet = document.createElement('faucet-view');
    mainnetFaucet.wallet = shell.wallet; document.body.append(mainnetFaucet); await mainnetFaucet.updateComplete`)
  assert.equal(await evaluate(`mainnetFaucet.shadowRoot.querySelector('testnet-faucet') === null`), true)
  assert.equal(await evaluate(`faucetReads === readsBeforeMainnet`), true)
  assert.deepEqual(errors, [])
})

test('identity refresh covers every subview, account copying, export and reduced motion', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await evaluate(`location.hash = '#!/identity/dashboard'`)
  await waitFor(`shell.shadowRoot.querySelector('identity-view')?.shadowRoot?.querySelector('identity-dashboard')?.shadowRoot?.querySelector('.hero')`)
  await evaluate(`globalThis.identityView = shell.shadowRoot.querySelector('identity-view');
    globalThis.identityPage = identityView.shadowRoot.querySelector('identity-dashboard'); undefined`)
  assert.equal(await evaluate(`identityPage.shadowRoot.querySelector('.metric strong').textContent`), '1')
  assert.equal(await evaluate(`identityPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent`), '1')
  assert.equal(await evaluate(`getComputedStyle(identityPage.shadowRoot.querySelector('.spark')).animationName !== 'none'`), true)
  await evaluate(`identityPage.shadowRoot.querySelector('a[href="#!/identity/accounts"]').click()`)
  await waitFor(`identityView.selectedRoute === 'accounts' && identityView.shadowRoot.querySelector('identity-accounts')?.shadowRoot?.querySelector('details')`)
  await evaluate(`globalThis.accountPage = identityView.shadowRoot.querySelector('identity-accounts');
    accountPage.shadowRoot.querySelector('summary').click();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async address => { globalThis.copiedIdentityAddress = address }
    } }); undefined`)
  assert.equal(await evaluate(`accountPage.shadowRoot.querySelector('details').open`), true)
  await evaluate(`accountPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`accountPage.message === 'Address copied.'`)
  assert.equal(await evaluate(`copiedIdentityAddress === shell.wallet.accounts[0][1]`), true)
  await evaluate(`navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied') };
    accountPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`accountPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`accountPage.error`), /Clipboard denied/)
  await evaluate(`globalThis.exportReads = 0; globalThis.exportShows = 0;
    shell.requestWalletPassword = async () => 'backup-password';
    globalThis.identityController = { export: () => { exportReads++; return new Promise(resolve => { globalThis.resolveBackup = resolve }) } };
    shell.showExport = (qr, exported) => { exportShows++; globalThis.exportedBackup = exported; globalThis.backupQR = qr };
    location.hash = '#!/identity/actions'`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-actions')?.shadowRoot?.querySelector('button')`)
  await evaluate(`globalThis.backupPage = identityView.shadowRoot.querySelector('identity-actions');
    backupPage.shadowRoot.querySelector('button').click(); backupPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`backupPage.exporting && globalThis.resolveBackup`)
  assert.equal(await evaluate(`exportReads`), 1)
  assert.equal(await evaluate(`backupPage.shadowRoot.querySelector('button').disabled`), true)
  await evaluate(`resolveBackup('encrypted-backup-fixture')`)
  await waitFor(`!backupPage.exporting && exportShows === 1`)
  assert.equal(await evaluate(`exportedBackup`), 'encrypted-backup-fixture')
  assert.match(await evaluate(`backupQR`), /^data:image\/png;base64,/)
  await evaluate(`identityController.export = async () => { throw new Error('Export failed') };
    backupPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`backupPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`backupPage.error`), /Export failed/)
  assert.equal(await evaluate(`backupPage.shadowRoot.querySelector('button').disabled`), false)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  for (const route of ['dashboard', 'accounts', 'account', 'actions']) {
    await evaluate(`location.hash = '#!/identity/${route}'`)
    await waitFor(`identityView.selectedRoute === '${route}' && identityView.shadowRoot.querySelector('identity-${route}')?.shadowRoot?.querySelector('.hero')`)
    await evaluate(`globalThis.activeIdentityPage = identityView.shadowRoot.querySelector('identity-${route}'); undefined`)
    assert.equal(await evaluate(`activeIdentityPage.shadowRoot.querySelector('.hero-art rect').namespaceURI`), 'http://www.w3.org/2000/svg')
    assert.equal(await evaluate(`getComputedStyle(activeIdentityPage.shadowRoot.querySelector('.spark')).animationName`), 'none')
    assert.equal(await evaluate(`getComputedStyle(activeIdentityPage.shadowRoot.querySelector('.card')).animationName`), 'none')
    if (route === 'account')
      assert.equal(await evaluate(`activeIdentityPage.shadowRoot.querySelector('details').open`), true)
    for (const width of [1280, 390, 320]) {
      await resize(width)
      assert.equal(await evaluate(`activeIdentityPage.scrollWidth <= activeIdentityPage.clientWidth`), true, `${route} overflow at ${width}`)
      assert.equal(await evaluate(`identityView.shadowRoot.querySelector('nav').getBoundingClientRect().right <= innerWidth`), true)
    }
  }
  await evaluate(`identityView.accounts = []; await identityView.select('accounts')`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-accounts')?.shadowRoot?.querySelector('.empty')`)
  assert.equal(await evaluate(`identityView.shadowRoot.querySelector('identity-accounts') === accountPage`), true)
  await evaluate(`await identityView.select('dashboard')`)
  await waitFor(`identityView.shadowRoot.querySelector('identity-dashboard')?.shadowRoot?.querySelector('.empty')`)
  assert.deepEqual(errors, [])
})

test('validator refresh shows registry, explicit participation, failures and responsive motion', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  await evaluate(`globalThis.participationCalls = 0; globalThis.lookupReads = 0;
    globalThis.validatorAddresses = [shell.wallet.selectedAccount, 'another-validator-address'];
    client.lookup = async () => { lookupReads++; return { address: 'validator-contract' } };
    client.staticCall = async () => validatorAddresses;
    client.selectedAccount = async () => shell.wallet.selectedAccount;
    client.participate = async () => { participationCalls++; return false };
    location.hash = '#!/validator'`)
  await waitFor(`shell.shadowRoot.querySelector('validator-view')?.loaded`)
  await evaluate(`globalThis.validatorPage = shell.shadowRoot.querySelector('validator-view'); undefined`)
  assert.equal(await evaluate(`participationCalls`), 0)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('.hero-art path').namespaceURI`), 'http://www.w3.org/2000/svg')
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('.metric strong').textContent.trim()`), '2')
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent.trim()`), 'Registered')
  await evaluate(`validatorPage.shadowRoot.querySelector('input').value = 'another';
    validatorPage.shadowRoot.querySelector('input').dispatchEvent(new Event('input'))`)
  await waitFor(`validatorPage.query === 'another'`)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('details').length`), 2)
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async address => { globalThis.copiedValidatorAddress = address }
  } });
    validatorPage.shadowRoot.querySelector('details summary').click();
    validatorPage.shadowRoot.querySelector('details button').click()`)
  await waitFor(`validatorPage.message === 'Validator address copied.'`)
  assert.equal(await evaluate(`copiedValidatorAddress`), 'another-validator-address')
  await evaluate(`validatorPage.shadowRoot.querySelector('input').value = 'nothing';
    validatorPage.shadowRoot.querySelector('input').dispatchEvent(new Event('input'))`)
  await waitFor(`validatorPage.shadowRoot.textContent.includes('No matching validators.')`)
  await evaluate(`window.confirm = () => false; validatorPage.shadowRoot.querySelector('button').click()`)
  assert.equal(await evaluate(`participationCalls`), 0)
  await evaluate(`window.confirm = () => true;
    client.participate = () => { participationCalls++; return new Promise(resolve => { globalThis.resolveParticipation = resolve }) };
    validatorPage.shadowRoot.querySelector('button').click();
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`globalThis.resolveParticipation && validatorPage.participating`)
  assert.equal(await evaluate(`participationCalls`), 1)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelector('button').disabled`), true)
  await evaluate(`resolveParticipation(false)`)
  await waitFor(`!validatorPage.participating && validatorPage.message.includes('Registration submitted')`)
  await evaluate(`client.participate = async () => { participationCalls++; return true };
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`!validatorPage.participating && validatorPage.message.includes('Participation enabled')`)
  await evaluate(`client.participate = async () => { throw new Error('Insufficient stake') };
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`validatorPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.match(await evaluate(`validatorPage.error`), /Insufficient stake/)
  await evaluate(`client.participate = async () => undefined;
    validatorPage.shadowRoot.querySelector('button').click()`)
  await waitFor(`validatorPage.error.includes('unknown participation status')`)
  await evaluate(`client.staticCall = async () => ({ invalid: true }); await validatorPage.refresh()`)
  assert.match(await evaluate(`validatorPage.error`), /invalid validator list/)
  await evaluate(`client.staticCall = async () => []; await validatorPage.refresh()`)
  await waitFor(`validatorPage.shadowRoot.querySelector('.empty')`)
  assert.equal(await evaluate(`validatorPage.shadowRoot.querySelectorAll('.metric strong')[1].textContent.trim()`), 'Not registered')
  await evaluate(`client.staticCall = async () => validatorAddresses; await validatorPage.refresh()`)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate(`getComputedStyle(validatorPage.shadowRoot.querySelector('.spark')).animationName`), 'none')
  for (const width of [1280, 390, 320]) {
    await resize(width)
    assert.equal(await evaluate(`validatorPage.scrollWidth <= validatorPage.clientWidth`), true, `validator overflow at ${width}`)
  }
  await evaluate(`client.staticCall = async () => { throw new Error('Registry unavailable') }; await validatorPage.refresh()`)
  assert.match(await evaluate(`validatorPage.error`), /Registry unavailable/)
  assert.deepEqual(errors, [])
})

test('explorer dashboard wires holder rankings and responsive activity cards', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  const { default: systemAddresses } = await import('@leofcoin/addresses')
  const { createChainIdentity } = await import('@leofcoin/lib/chain-identity')
  const explorerIdentity = await createChainIdentity('leofcoin:peach', systemAddresses)
  await evaluate(`globalThis.fixtureClient = client;
    globalThis.balanceReads = 0;
    chain.getChainIdentity = async () => (${JSON.stringify(explorerIdentity)});
    globalThis.client = {
      lookup: async name => ({ address: name === 'LeofcoinContractFactory' ? ${JSON.stringify(systemAddresses.nameService)} : ${JSON.stringify(systemAddresses.validators)} }),
      staticCall: async (address, method, params = []) => {
        if (!Array.isArray(params)) throw new Error('Invalid read-only contract query');
        if (method === 'totalContracts' && address !== ${JSON.stringify(systemAddresses.contractFactory)})
          throw new Error('ContractFactory query reached the wrong contract');
        return method === 'validators' ? [] : 0;
      },
      nativeTransfers: async () => 0, nativeBurns: async () => 0, nativeMints: async () => 0,
      nativeCalls: async () => 0, totalContracts: async () => 0, lastBlockHeight: async () => 0,
      totalTransactions: async () => 0, totalSize: async () => 0,
      transactionsInPool: async () => 0, transactionPoolSize: async () => 0,
      peers: async () => [], blocks: async amount => { if (amount !== -128) throw new Error('Unbounded read'); return [] },
      balances: async () => { balanceReads++; return { Alice: 2000000000000000000n, Bob: 1000000000000000000n } },
      pubsub: fixtureClient.pubsub || pubsub
    };
    await import('/explorer-dashboard.js');
    pubsub.publish('node:ready', true);
    globalThis.rankDashboard = document.createElement('explorer-dashboard');
    rankDashboard.nodeStarted = true;
    rankDashboard.isNodeReady = true;
    shell.shadowRoot.querySelector('#main-content').replaceChildren(rankDashboard);
    undefined`)
  await waitFor(`rankDashboard.dashboardError || rankDashboard.shadowRoot.querySelector('explorer-dashboard-rankings')?.shadowRoot?.querySelector('ol')`)
  assert.equal(await evaluate('rankDashboard.dashboardError'), '', 'dashboard contract parameters must use the read-only array schema')
  assert.equal(await evaluate(`balanceReads`), 1)
  await evaluate(`globalThis.rankCards = rankDashboard.shadowRoot.querySelector('explorer-dashboard-rankings'); undefined`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li .address').textContent`), 'Alice')
  assert.match(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').textContent`), /^2(?:\.0+)? LFC$/)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('No contract calls in this sample.')`), true)
  await evaluate(`rankCards.activity = {
    blocks: 128, start: 10, end: 137,
    contracts: [{ address: 'TokenContract', count: 12, callers: 3 }],
    addresses: [{ address: 'Alice', count: 7 }]
  }; await rankCards.updateComplete`)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('128 sampled blocks')`), true)
  assert.equal(await evaluate(`rankCards.shadowRoot.textContent.includes('12 calls')`), true)
  await evaluate(`rankCards.holders = { total: 1, holders: [{
    address: 'YTqyQkkaMKMTShz7LQh8XdxdZ2GPsXkd1bYHpqQWEF7tQy12345678',
    balance: 5000226027397260273972572n, share: 100
  }] }; await rankCards.updateComplete`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').textContent`), '5,000,226.0273… LFC')
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li strong').title`), '5000226.027397260273972572 LFC')
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('ol li .address').textContent.length <= 22`), true)
  await evaluate(`globalThis.alignmentCharts = document.createElement('explorer-dashboard-charts');
    rankCards.before(alignmentCharts); undefined`)
  for (const width of [1600, 1280, 390]) {
    await resize(width)
    await evaluate(`new Promise(requestAnimationFrame)`)
    assert.equal(await evaluate(`rankCards.scrollWidth <= rankCards.clientWidth`), true)
    assert.equal(await evaluate(`(() => {
      const ranks = rankCards.shadowRoot.querySelector('.rankings').getBoundingClientRect();
      const charts = alignmentCharts.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(alignmentCharts).paddingLeft);
      return Math.abs(ranks.left - charts.left - padding) < 1 &&
        Math.abs(ranks.right - charts.right + padding) < 1;
    })()`), true, `Ranking cards must align with chart content at ${width}px`)
  }
  await evaluate(`alignmentCharts.remove()`)
  await evaluate(`client.balances = async () => { throw new Error('Balance lookup failed') }; await rankDashboard.updateInfo()`)
  await waitFor(`rankCards.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`rankCards.shadowRoot.querySelector('[role="alert"]').textContent.includes('Balance lookup failed')`), true)
  assert.deepEqual(errors, [])
})

test('explorer block details show encoded size, transactions, recovery and latest selection', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { BlockMessage } = await import('@leofcoin/messages')
  const block = {
    index: 594n, previousHash: 'previous-block-hash', timestamp: Date.now(),
    fees: 123456789012345678n, reward: 2000000000000000000n,
    producer: 'producer-address', producerProof: '', protocolVersion: '1',
    validators: [{ address: 'validator-address', reward: 2000000000000000000n }],
    transactions: [{
      from: 'sender-address', to: 'contract-address', method: 'transfer',
      params: ['recipient-address', '100'], timestamp: Date.now(), signature: ''
    }]
  }
  const encoded = new BlockMessage(block).encode()
  const empty = new BlockMessage({ ...block, index: 0n, previousHash: '', transactions: [], validators: [] }).encode()
  const blockHash = await new BlockMessage(encoded).hash()
  const emptyHash = await new BlockMessage(empty).hash()
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  await evaluate(`globalThis.blockBytes = new Uint8Array(${JSON.stringify([...encoded])});
    globalThis.emptyBlockBytes = new Uint8Array(${JSON.stringify([...empty])});
    globalThis.peernet = { get: async () => blockBytes };
    await import('/explorer-block.js');
    globalThis.blockPage = document.createElement('explorer-block');
    shell.shadowRoot.querySelector('#main-content').replaceChildren(blockPage);
    blockPage.selected = ${JSON.stringify(blockHash)}; undefined`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.querySelector('table')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('h1').textContent`), 'Block #594')
  assert.equal(await evaluate(`blockPage.size`), encoded.byteLength)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('tbody tr').textContent.includes('transfer')`), true)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('tbody tr').textContent.includes('sender-address')`), true)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelectorAll('.metrics article').length`), 4)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('fees burnt')`), false)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('nav a:last-child').getAttribute('href')`),
    '#!/explorer/block?selected=previous-block-hash')
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
    writeText: async value => { globalThis.copiedBlockValue = value }
  } });
  blockPage.shadowRoot.querySelector('[aria-label="Copy block hash"]').click()`)
  await waitFor(`blockPage.copyStatus === 'Block hash copied.'`)
  assert.equal(await evaluate(`copiedBlockValue === blockPage.hash`), true)
  await evaluate(`navigator.clipboard.writeText = async () => { throw new Error('Permission denied') };
    blockPage.shadowRoot.querySelector('[aria-label="Copy block hash"]').click()`)
  await waitFor(`blockPage.copyStatus.includes('Permission denied')`)
  for (const width of [1280, 390, 320]) {
    await resize(width)
    assert.equal(await evaluate(`blockPage.scrollWidth <= blockPage.clientWidth`), true,
      `Block details overflow at ${width}px`)
  }
  await evaluate(`peernet.get = async () => undefined; blockPage.selected = 'missing-block'`)
  await waitFor(`blockPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('Block not found.')`), true)
  await evaluate(`peernet.get = async () => { throw new Error('Peer unavailable') }; blockPage.selected = 'failed-block'`)
  await waitFor(`blockPage.error === 'Peer unavailable' && blockPage.shadowRoot.querySelector('[role="alert"]')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('Peer unavailable')`), true)
  await evaluate(`peernet.get = async () => undefined; blockPage.selected = ${JSON.stringify(emptyHash)}`)
  await waitFor(`blockPage.error === 'Block not found.'`)
  await evaluate(`peernet.get = async () => emptyBlockBytes;
    blockPage.shadowRoot.querySelector('[role="alert"] button').click()`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.textContent.includes('No transactions')`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelectorAll('nav a').length`), 1)
  assert.equal(await evaluate(`blockPage.shadowRoot.textContent.includes('No validators recorded')`), true)
  await evaluate(`peernet.get = hash => hash === 'slow' ? new Promise(resolve => { globalThis.resolveSlowBlock = resolve })
    : Promise.resolve(blockBytes); blockPage.selected = 'slow'`)
  await waitFor(`globalThis.resolveSlowBlock`)
  await evaluate(`blockPage.selected = ${JSON.stringify(blockHash)}`)
  await waitFor(`blockPage.block && blockPage.shadowRoot.querySelector('h1').textContent === 'Block #594'`)
  await evaluate(`resolveSlowBlock(emptyBlockBytes); new Promise(resolve => setTimeout(resolve, 50))`)
  assert.equal(await evaluate(`blockPage.shadowRoot.querySelector('h1').textContent`), 'Block #594')
  assert.deepEqual(errors, [])
})

test('node activity dashboard shows real observed traffic, filters and sync status', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, errors } = await createShellFixture(t)
  await evaluate(`shell.shadowRoot.querySelector('a[data-route="stats"]').click()`)
  await waitFor(`shell.currentRoute === 'stats' && shell.shadowRoot.querySelector('stats-view')?.shadowRoot`)
  assert.equal(await evaluate(`location.hash`), '#!/stats')
  await evaluate(`globalThis.activity = shell.shadowRoot.querySelector('stats-view');
    globalThis.requestResult = Promise.resolve(new Uint8Array(7));
    globalThis.peernet = {
      connections: { 'activity-peer': { id: 'activity-peer', version: '0.4.0', connected: true, request: () => requestResult } },
      _protoHandler: message => message,
      sendMessage: () => Promise.resolve('id')
    }; undefined`)
  await waitFor(`activity.nodeStatus.peers.includes('activity-peer')`)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[1].click();
    peernet.connections['activity-peer'].request(new Uint8Array(4));
    peernet._protoHandler({ proto: { name: 'peernet-data', encoded: new Uint8Array(9) } }, { id: 'activity-peer' }, 'activity-peer');
    peernet.sendMessage({ id: 'activity-peer' }, 'id', new Uint8Array(5));
    fetch('/not-an-endpoint?token=do-not-retain')`)
  await waitFor(`activity.snapshot.totals.outgoing >= 3 && activity.snapshot.totals.errors >= 1`)
  assert.equal(await evaluate(`activity.snapshot.events.some(event => event.transport === 'HTTP' && event.outcome === 'error')`), true)
  assert.equal(await evaluate(`activity.shadowRoot.textContent.includes('do-not-retain')`), false)
  await evaluate(`activity.shadowRoot.querySelector('[aria-label="Traffic transport"]').value = 'P2P';
    activity.shadowRoot.querySelector('[aria-label="Traffic transport"]').dispatchEvent(new Event('change'))`)
  await waitFor(`activity.transport === 'P2P'`)
  assert.equal(await evaluate(`Array.from(activity.shadowRoot.querySelectorAll('tbody tr')).every(row => row.cells[2].textContent === 'P2P')`), true)
  await evaluate(`activity.shadowRoot.querySelector('[aria-label="Traffic direction"]').value = 'in';
    activity.shadowRoot.querySelector('[aria-label="Traffic direction"]').dispatchEvent(new Event('change'))`)
  await waitFor(`activity.direction === 'in'`)
  assert.equal(await evaluate(`activity.shadowRoot.querySelectorAll('tbody tr').length`), 2)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[0].click()`)
  await waitFor(`activity.paused`)
  const count = await evaluate(`activity.snapshot.totals.incoming`)
  await evaluate(`peernet._protoHandler({ proto: { name: 'peernet-data', encoded: new Uint8Array(9) } }, {}, 'activity-peer')`)
  await new Promise((resolve) => setTimeout(resolve, 1100))
  assert.equal(await evaluate(`activity.snapshot.totals.incoming`), count)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[0].click()`)
  await waitFor(`activity.snapshot.totals.incoming > ${count}`)
  await evaluate(`chain.lastBlock = Promise.resolve({ index: 150 });
    pubsub.publish('sync-progress', { startIndex: 100, localIndex: 150, targetIndex: 200 });
    chain.state.sync = 'syncing'`)
  await waitFor(`activity.nodeStatus.progress === 50 && activity.nodeStatus.local === 150`)
  assert.equal(await evaluate(`activity.shadowRoot.querySelector('progress').value`), 50)
  await resize(390)
  assert.equal(await evaluate(`activity.scrollWidth <= activity.clientWidth`), true)
  await evaluate(`activity.shadowRoot.querySelectorAll('button')[1].click()`)
  await waitFor(`activity.snapshot.events.length === 0`)
  assert.deepEqual(errors, [])
})

test('bottom status bar shows sync, peers and blocks across views and screen sizes', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, call, errors } = await createShellFixture(t)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('header .sync-status-pill') === null`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('wallet-view').shadowRoot.querySelector('wallet-send').shadowRoot.querySelector('.network') === null`), true)
  await waitFor(`shell.connectedPeers === 1 && shell.isNodeReady`)
  await evaluate(`shell.chainId = 'lfc:fixture-chain-id'; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.extra-nav-rail').textContent.includes('Chain ID')`), false)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.extra-nav-rail code') === null`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').textContent.includes('Node synced')`), true)
  await evaluate(`chain.lastBlock = Promise.resolve({ index: 123 }); shell.lastBlockIndex = 123; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.block-status').textContent`), '#123')
  await evaluate(`shell.shadowRoot.querySelector('.node-status-bar button').click()`)
  await waitFor(`shell.shadowRoot.querySelector('sync-info')?.open`)
  await evaluate(`shell.shadowRoot.querySelector('sync-info').dispatchEvent(new CustomEvent('sync-info-close'))`)
  await waitFor(`!shell.syncInfoOpen`)
  await evaluate(`chain.state.sync = 'syncing'; shell.syncTargetIndex = 200; shell.syncStartIndex = 100`)
  await waitFor(`!shell.isNodeReady && shell.syncLabel === 'Syncing 23%'`)
  await evaluate(`peernet.connections.fixture.connected = false`)
  await waitFor(`shell.connectedPeers === 0 && shell.syncLabel === 'Waiting for peers'`)
  await evaluate(`shell.nodeStartError = 'Fixture node failed'; await shell.rendered`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.sync-status-pill').dataset.state`), 'error')
  await evaluate(`shell.nodeStartError = ''; shell.nodeStarted = false; await shell.rendered`)
  await waitFor(`shell.syncLabel === 'Wallet locked'`)
  await evaluate(`await shell.select('address-book')`)
  for (const width of [1280, 390, 320]) {
    await resize(width)
    await call('Runtime.evaluate', { expression: 'new Promise(requestAnimationFrame)', awaitPromise: true })
    assert.equal(await evaluate(`(() => {
      const bar = shell.shadowRoot.querySelector('.node-status-bar')
      const rect = bar.getBoundingClientRect()
      const content = shell.shadowRoot.querySelector('#main-content').getBoundingClientRect()
      const drawer = shell.shadowRoot.querySelector('#app-navigation').getBoundingClientRect()
      return Math.abs(rect.left) < 1 && Math.abs(rect.right - innerWidth) < 1
        && Math.abs(rect.bottom - innerHeight) < 1
        && (!shell.isDesktop || drawer.bottom <= rect.top + 1)
        && content.bottom <= rect.top + 1 && bar.scrollWidth <= bar.clientWidth
    })()`), true, `status bar layout at ${width}px`)
  }
  await evaluate(`shell.shadowRoot.querySelector('.menu-toggle').click()`)
  await waitFor(`shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').inert`), true)
  await evaluate(`shell.shadowRoot.querySelector('.drawer-close').click()`)
  await waitFor(`!shell.drawerOpen`)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('.node-status-bar').inert`), false)
  assert.deepEqual(errors, [])
})

test('drawer address book CRUD and searchable recipient dialog', {
  skip: !runShellUiTests, timeout: 30000
}, async t => {
  const { evaluate, waitFor, resize, click, call, errors } = await createShellFixture(t)
  await evaluate(`globalThis.walletView = shell.shadowRoot.querySelector('wallet-view');
    globalThis.cachedSendView = walletView.shadowRoot.querySelector('wallet-send'); undefined`)
  const assertRecipientPicker = async () => {
    assert.equal(await evaluate(`(() => {
      const button = cachedSendView.shadowRoot.querySelector('.recipient-picker')
      const input = cachedSendView.shadowRoot.querySelector('#recipient-address')
      const buttonRect = button.getBoundingClientRect()
      const inputRect = input.getBoundingClientRect()
      return button.getAttribute('aria-label') === 'Choose from address book'
        && Boolean(button.querySelector('svg'))
        && buttonRect.width >= 44 && buttonRect.height >= 44
        && buttonRect.left > inputRect.left && buttonRect.right <= inputRect.right
        && buttonRect.top >= inputRect.top && buttonRect.bottom <= inputRect.bottom
        && parseFloat(getComputedStyle(input).paddingRight) >= buttonRect.width
    })()`), true)
  }
  await assertRecipientPicker()
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('form') === null`), true)
  await evaluate(`cachedSendView.to = 'manual-address'; cachedSendView.amount = '1.25';
    shell.shadowRoot.querySelector('a[data-route="address-book"]').click()`)
  await waitFor(`shell.currentRoute === 'address-book' && shell.shadowRoot.querySelector('address-book-view')?.shadowRoot`)
  assert.equal(await evaluate(`location.hash`), '#!/address-book')
  assert.equal(await evaluate(`Boolean(shell.shadowRoot.querySelector('address-book-view').shadowRoot.querySelector('.hero-art[aria-hidden="true"]'))`), true)
  assert.equal(await evaluate(`shell.shadowRoot.querySelector('a[data-route="address-book"]').getAttribute('aria-current')`), 'page')
  await evaluate(`globalThis.book = shell.shadowRoot.querySelector('address-book-view');
    book.shadowRoot.querySelector('[aria-label="Contact name"]').value = 'Alice';
    book.shadowRoot.querySelector('[aria-label="Contact name"]').dispatchEvent(new Event('input'));
    Array.from(book.shadowRoot.querySelectorAll('button')).find(button => button.textContent === 'Use my address').click();
    await book.updateComplete;
    book.shadowRoot.querySelector('form').requestSubmit()`)
  await waitFor(`book.contacts.length === 1 && !book.saving`)
  assert.equal(await evaluate(`book.contacts[0].address === shell.wallet.selectedAccount`), true)
  await evaluate(`book.shadowRoot.querySelector('[aria-label="Rename Alice"]').click()`)
  await waitFor(`book.shadowRoot.querySelector('[aria-label="Rename contact"]')`)
  await evaluate(`book.shadowRoot.querySelector('[aria-label="Rename contact"]').value = 'Alice Wallet';
    book.shadowRoot.querySelector('[aria-label="Rename contact"]').dispatchEvent(new Event('input'));
    book.shadowRoot.querySelector('.contact form').requestSubmit()`)
  await waitFor(`book.contacts[0].name === 'Alice Wallet' && !book.editingAddress`)
  await evaluate(`shell.shadowRoot.querySelector('a[data-route="wallet"]').click()`)
  await waitFor(`shell.currentRoute === 'wallet' && walletView.shadowRoot.querySelector('wallet-send') === cachedSendView`)
  await click(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]')`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('dialog').open && cachedSendView.contacts.length === 1`)
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  assert.equal(await evaluate(`getComputedStyle(cachedSendView.shadowRoot.querySelector('dialog')).animationName`), 'none')
  await call('Emulation.setEmulatedMedia', { features: [] })
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog .contact-choice strong').textContent`), 'Alice Wallet')
  await evaluate(`cachedSendView.shadowRoot.querySelector('[aria-label="Search contacts"]').value = 'missing';
    cachedSendView.shadowRoot.querySelector('[aria-label="Search contacts"]').dispatchEvent(new Event('input'))`)
  await waitFor(`!cachedSendView.shadowRoot.querySelector('.contact-choice')`)
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await waitFor(`!cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`cachedSendView.to`), 'manual-address')
  assert.equal(await evaluate(`cachedSendView.shadowRoot.activeElement.getAttribute('aria-haspopup')`), 'dialog')
  await evaluate(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]').click()`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('.contact-choice')`)
  await evaluate(`cachedSendView.shadowRoot.querySelector('.contact-choice').click()`)
  await waitFor(`!cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.equal(await evaluate(`cachedSendView.to === shell.wallet.selectedAccount`), true)
  assert.equal(await evaluate(`cachedSendView.amount`), '1.25')
  assert.equal(await evaluate(`cachedSendView.shadowRoot.activeElement.getAttribute('aria-label')`), 'Recipient address')

  await resize(390)
  await waitFor(`!shell.isDesktop`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await click(`shell.shadowRoot.querySelector('a[data-route="address-book"]')`)
  await waitFor(`shell.currentRoute === 'address-book' && book.isConnected && !shell.drawerOpen`)
  assert.equal(await evaluate(`book.scrollWidth <= book.clientWidth`), true)
  await evaluate(`globalThis.savedConfirm = window.confirm;
    window.confirm = () => false;
    book.shadowRoot.querySelector('[aria-label="Remove Alice Wallet"]').click();
    window.confirm = savedConfirm`)
  assert.equal(await evaluate(`book.contacts.length`), 1)
  await evaluate(`window.confirm = () => true;
    book.shadowRoot.querySelector('[aria-label="Remove Alice Wallet"]').click();
    window.confirm = savedConfirm`)
  await waitFor(`book.contacts.length === 0`)
  await click(`shell.shadowRoot.querySelector('.menu-toggle')`)
  await waitFor(`shell.drawerOpen`)
  await click(`shell.shadowRoot.querySelector('a[data-route="wallet"]')`)
  await waitFor(`shell.currentRoute === 'wallet' && cachedSendView.isConnected && !shell.drawerOpen`)
  await assertRecipientPicker()
  await click(`cachedSendView.shadowRoot.querySelector('[aria-haspopup="dialog"]')`)
  await waitFor(`cachedSendView.shadowRoot.querySelector('dialog').open && cachedSendView.contacts.length === 0`)
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog').textContent.includes('No saved contacts yet')`), true)
  assert.equal(await evaluate(`cachedSendView.shadowRoot.querySelector('dialog').getBoundingClientRect().right <= innerWidth`), true)
  await evaluate(`cachedSendView.shadowRoot.querySelector('dialog a').click()`)
  await waitFor(`shell.currentRoute === 'address-book' && !cachedSendView.shadowRoot.querySelector('dialog').open`)
  assert.deepEqual(errors, [])
})
