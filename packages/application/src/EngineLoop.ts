export interface EngineLoop {
    /**
     * Starts the recurring engine loop. The provided `tickFn` should be called 
     * periodically as often as possible (e.g. via requestAnimationFrame or setInterval).
     */
    start(tickFn: () => void): void;
    
    /**
     * Stops the recurring engine loop.
     */
    stop(): void;
}
