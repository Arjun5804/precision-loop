class DummyProcessor extends AudioWorkletProcessor {
    process() { return true; }
}
registerProcessor('recording-processor', DummyProcessor);
