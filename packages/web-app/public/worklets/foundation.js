class DummyProcessor extends AudioWorkletProcessor {
    process() { return true; }
}
registerProcessor('foundation-processor', DummyProcessor);
