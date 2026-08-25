(() => {
  // ../packages/audio-engine/src/errors.ts
  var AudioEngineError = class extends Error {
    constructor(message, cause) {
      super(message);
      this.cause = cause;
      this.name = "AudioEngineError";
    }
  };
  var AudioContextInitializationError = class extends AudioEngineError {
    constructor(message, cause) {
      super(message, cause);
      this.name = "AudioContextInitializationError";
    }
  };
  var AudioContextStateError = class extends AudioEngineError {
    constructor(message, cause) {
      super(message, cause);
      this.name = "AudioContextStateError";
    }
  };
  var AudioDeviceError = class extends AudioEngineError {
    constructor(message, cause) {
      super(message, cause);
      this.name = "AudioDeviceError";
    }
  };
  var AudioWorkletInitializationError = class extends AudioEngineError {
    constructor(message, cause) {
      super(message, cause);
      this.name = "AudioWorkletInitializationError";
    }
  };
  var UnsupportedAudioFeatureError = class extends AudioEngineError {
    constructor(message, cause) {
      super(message, cause);
      this.name = "UnsupportedAudioFeatureError";
    }
  };

  // ../packages/audio-engine/src/capabilities.ts
  function detectCapabilities(audioContextClass = globalThis.AudioContext) {
    return {
      supportsOutputSelection: typeof audioContextClass !== "undefined" && "setSinkId" in audioContextClass.prototype
    };
  }

  // ../packages/audio-engine/src/scheduler-adapter.ts
  function createAudioTimeSource(getContext) {
    return {
      get currentTime() {
        return getContext().currentTime;
      }
    };
  }

  // ../packages/audio-engine/src/audio-context.ts
  var ManagedAudioContext = class {
    constructor(ContextClass = globalThis.AudioContext) {
      this.ContextClass = ContextClass;
      this.boundHandleStateChange = this.handleStateChange.bind(this);
    }
    _context = null;
    _state = "uninitialized";
    callbacks = /* @__PURE__ */ new Set();
    boundHandleStateChange;
    get context() {
      if (!this._context) {
        throw new AudioContextStateError("AudioContext is not initialized");
      }
      return this._context;
    }
    get state() {
      return this._state;
    }
    get sampleRate() {
      return this.context.sampleRate;
    }
    get baseLatency() {
      return this.context.baseLatency;
    }
    get outputLatency() {
      if ("outputLatency" in this.context) {
        return this.context.outputLatency;
      }
      return null;
    }
    initialize(latencyHint = "interactive") {
      if (this._context) {
        throw new AudioContextInitializationError("AudioContext is already initialized");
      }
      try {
        this.updateState("initializing");
        this._context = new this.ContextClass({ latencyHint });
        this._context.addEventListener("statechange", this.boundHandleStateChange);
        this.syncState();
      } catch (err) {
        this.updateState("error");
        throw new AudioContextInitializationError("Failed to create AudioContext", err);
      }
    }
    async resume() {
      const ctx = this.context;
      if (ctx.state === "running") return;
      try {
        await ctx.resume();
      } catch (err) {
        throw new AudioContextStateError("Failed to resume AudioContext", err);
      }
    }
    async suspend() {
      const ctx = this.context;
      if (ctx.state === "suspended") return;
      try {
        await ctx.suspend();
      } catch (err) {
        throw new AudioContextStateError("Failed to suspend AudioContext", err);
      }
    }
    async close() {
      if (!this._context) {
        this.updateState("closed");
        return;
      }
      this._context.removeEventListener("statechange", this.boundHandleStateChange);
      try {
        if (this._context.state !== "closed") {
          await this._context.close();
        }
      } catch (err) {
      } finally {
        this._context = null;
        this.updateState("closed");
        this.callbacks.clear();
      }
    }
    onStateChange(callback) {
      this.callbacks.add(callback);
      return () => {
        this.callbacks.delete(callback);
      };
    }
    handleStateChange() {
      this.syncState();
    }
    syncState() {
      if (!this._context) return;
      switch (this._context.state) {
        case "suspended":
          this.updateState("suspended");
          break;
        case "running":
          this.updateState("running");
          break;
        case "closed":
          this.updateState("closed");
          break;
      }
    }
    updateState(newState) {
      if (this._state === newState) return;
      this._state = newState;
      for (const callback of this.callbacks) {
        try {
          callback(this._state);
        } catch (e) {
          console.error("Error in state change callback:", e);
        }
      }
    }
  };

  // ../packages/audio-engine/src/audio-devices.ts
  var AudioDeviceManager = class {
    constructor(mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : void 0) {
      this.mediaDevices = mediaDevices;
      this.boundHandleDeviceChange = this.handleDeviceChange.bind(this);
    }
    devices = [];
    callbacks = /* @__PURE__ */ new Set();
    boundHandleDeviceChange;
    async initialize() {
      if (!this.mediaDevices) {
        return;
      }
      try {
        await this.refreshDevices();
        this.mediaDevices.addEventListener("devicechange", this.boundHandleDeviceChange);
      } catch (err) {
        throw new AudioDeviceError("Failed to initialize AudioDeviceManager", err);
      }
    }
    getDevices() {
      return this.devices;
    }
    onDeviceChange(callback) {
      this.callbacks.add(callback);
      return () => {
        this.callbacks.delete(callback);
      };
    }
    close() {
      if (this.mediaDevices) {
        this.mediaDevices.removeEventListener("devicechange", this.boundHandleDeviceChange);
      }
      this.callbacks.clear();
    }
    async refreshDevices() {
      if (!this.mediaDevices) return;
      try {
        const rawDevices = await this.mediaDevices.enumerateDevices();
        this.devices = rawDevices.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput").map((d) => ({
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind,
          label: d.label
          // May be empty before permission is granted
        }));
      } catch (err) {
        throw new AudioDeviceError("Failed to enumerate devices", err);
      }
    }
    async handleDeviceChange() {
      await this.refreshDevices();
      this.notifyCallbacks();
    }
    notifyCallbacks() {
      for (const callback of this.callbacks) {
        try {
          callback(this.devices);
        } catch (e) {
          console.error("Error in device change callback:", e);
        }
      }
    }
  };

  // ../packages/audio-engine/src/audio-graph.ts
  var AudioGraph = class {
    masterGain;
    constructor(context) {
      this.masterGain = context.createGain();
      this.masterGain.connect(context.destination);
    }
    close() {
      try {
        this.masterGain.disconnect();
      } catch {
      }
    }
  };

  // ../packages/audio-engine/src/audio-engine.ts
  var AudioEngine = class {
    constructor(ContextClass = globalThis.AudioContext, mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : void 0) {
      this.ContextClass = ContextClass;
      this.mediaDevices = mediaDevices;
      this.managedContext = new ManagedAudioContext(this.ContextClass);
      this.deviceManager = new AudioDeviceManager(this.mediaDevices);
      this._capabilities = detectCapabilities(this.ContextClass);
    }
    managedContext;
    deviceManager;
    graph = null;
    _capabilities;
    async initialize(options = {}) {
      const latencyHint = options.latencyHint ?? "interactive";
      this.managedContext.initialize(latencyHint);
      this.graph = new AudioGraph(this.managedContext.context);
      await this.deviceManager.initialize();
    }
    /**
     * Separated Worklet initialization.
     * Loads the foundation worklet from the provided URL to verify infrastructure.
     */
    async initializeWorklets(foundationWorkletUrl) {
      if (this.state === "uninitialized") {
        throw new AudioEngineError("AudioEngine must be initialized before loading worklets");
      }
      try {
        await this.managedContext.context.audioWorklet.addModule(foundationWorkletUrl);
        const node = new AudioWorkletNode(this.managedContext.context, "foundation-processor");
        node.connect(this.graph.masterGain);
        node.disconnect();
      } catch (err) {
        throw new AudioWorkletInitializationError("Failed to initialize AudioWorklet infrastructure", err);
      }
    }
    // Facade Methods for Context State
    get state() {
      return this.managedContext.state;
    }
    onStateChange(callback) {
      return this.managedContext.onStateChange(callback);
    }
    async resume() {
      await this.managedContext.resume();
    }
    async suspend() {
      await this.managedContext.suspend();
    }
    async close() {
      this.deviceManager.close();
      if (this.graph) {
        this.graph.close();
        this.graph = null;
      }
      await this.managedContext.close();
    }
    // Runtime properties
    get runtimeInfo() {
      return {
        sampleRate: this.managedContext.sampleRate,
        baseLatency: this.managedContext.baseLatency,
        outputLatency: this.managedContext.outputLatency
      };
    }
    get capabilities() {
      return this._capabilities;
    }
    // Devices
    get devices() {
      return this.deviceManager.getDevices();
    }
    onDeviceChange(callback) {
      return this.deviceManager.onDeviceChange(callback);
    }
    async setOutputDevice(deviceId) {
      if (!this.capabilities.supportsOutputSelection) {
        throw new UnsupportedAudioFeatureError("Output device selection (setSinkId) is not supported in this environment");
      }
      try {
        await this.managedContext.context.setSinkId(deviceId);
      } catch (err) {
        throw new AudioEngineError("Failed to set output device", err);
      }
    }
    // Scheduler Boundary
    createAudioTimeSource() {
      return createAudioTimeSource(() => this.managedContext.context);
    }
  };

  // verify.ts
  async function run() {
    const log = document.getElementById("log");
    const appendLog = (msg) => {
      console.log(msg);
      log.textContent += msg + "\n";
    };
    try {
      appendLog("Initializing AudioEngine...");
      const engine = new AudioEngine();
      await engine.initialize();
      appendLog(`AudioContext initialized. State: ${engine.state}`);
      appendLog("Resuming AudioContext...");
      await engine.resume();
      appendLog(`AudioContext resumed. State: ${engine.state}`);
      appendLog("Initializing Worklets...");
      await engine.initializeWorklets("/foundation-processor.js");
      appendLog("Worklets initialized successfully.");
      appendLog("Verification successful!");
      document.body.style.backgroundColor = "lightgreen";
    } catch (err) {
      appendLog(`Error: ${err.message}`);
      console.error(err);
      document.body.style.backgroundColor = "lightcoral";
    }
  }
  document.getElementById("start").addEventListener("click", run);
})();
