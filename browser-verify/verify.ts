import { AudioEngine } from '../packages/audio-engine/src';

async function run() {
  const log = document.getElementById('log')!;
  const appendLog = (msg: string) => {
    console.log(msg);
    log.textContent += msg + '\n';
  };

  try {
    appendLog('Initializing AudioEngine...');
    const engine = new AudioEngine();
    await engine.initialize();
    appendLog(`AudioContext initialized. State: ${engine.state}`);

    appendLog('Resuming AudioContext...');
    await engine.resume();
    appendLog(`AudioContext resumed. State: ${engine.state}`);

    appendLog('Initializing Worklets...');
    // The path here depends on how the HTML file is served, 
    // assuming we copy foundation-processor.js to the same directory or serve from root
    await engine.initializeWorklets('/foundation-processor.js');
    appendLog('Worklets initialized successfully.');
    
    appendLog('Verification successful!');
    document.body.style.backgroundColor = 'lightgreen';
  } catch (err: any) {
    appendLog(`Error: ${err.message}`);
    console.error(err);
    document.body.style.backgroundColor = 'lightcoral';
  }
}

document.getElementById('start')!.addEventListener('click', run);
