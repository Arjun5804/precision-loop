import { EngineLoop } from '@precision-loop/application';

export class BrowserEngineLoop implements EngineLoop {
    private activeId: number | null = null;
    private running: boolean = false;

    public start(tickFn: () => void): void {
        if (this.running) return;
        this.running = true;

        const loop = () => {
            if (!this.running) return;
            tickFn();
            this.activeId = requestAnimationFrame(loop);
        };

        this.activeId = requestAnimationFrame(loop);
    }

    public stop(): void {
        this.running = false;
        if (this.activeId !== null) {
            cancelAnimationFrame(this.activeId);
            this.activeId = null;
        }
    }
}
