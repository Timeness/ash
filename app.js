const { createApp } = Vue;

function encodeNonce(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeNonce(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function validateUrl(value) {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("Only http:// and https:// links are supported.");
    }
    return url.href;
}

function getNonceFromQuery() {
    const search = window.location.search;
    if (search.startsWith("?u:")) return search.slice(3);
    return new URLSearchParams(search).get("u") || "";
}

function getBasePath() {
    return new URL(".", window.location.href).pathname;
}

function getRoutePath() {
    const basePath = getBasePath();
    const pathname = window.location.pathname;
    const route = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.slice(1);
    return `/${route}`;
}

createApp({
    data() {
        return {
            destination: "",
            nonce: "",
            saveUrl: "",
            clickUrl: "",
            error: "",
            copied: "",
            view: "home"
        };
    },
    mounted() {
        this.readRoute();
    },
    methods: {
        readRoute() {
            const path = getRoutePath();
            if (path.startsWith("/save:")) {
                try {
                    const target = validateUrl(decodeURIComponent(path.slice(6)));
                    this.showSavedLink(target);
                } catch (error) {
                    this.error = error.message || "That save link is not valid.";
                    this.view = "error";
                }
                return;
            }

            if (path === "/click" || path === "/click/") {
                try {
                    const target = validateUrl(decodeNonce(getNonceFromQuery()));
                    window.location.replace(target);
                    this.view = "redirecting";
                } catch {
                    this.error = "This redirect link is invalid or incomplete.";
                    this.view = "error";
                }
            }
        },
        makeLink() {
            this.error = "";
            try {
                const target = validateUrl(this.destination.trim());
                const savePath = `${getBasePath()}save:${encodeURIComponent(target)}`;
                window.history.pushState({}, "", savePath);
                this.showSavedLink(target);
            } catch (error) {
                this.error = error.message || "Enter a valid destination URL.";
            }
        },
        showSavedLink(target) {
            this.destination = target;
            this.nonce = encodeNonce(target);
            const basePath = getBasePath();
            this.saveUrl = `${window.location.origin}${basePath}save:${encodeURIComponent(target)}`;
            this.clickUrl = `${window.location.origin}${basePath}click?u=${this.nonce}`;
            this.view = "saved";
        },
        async copy(value, name) {
            try {
                await navigator.clipboard.writeText(value);
                this.copied = name;
                window.setTimeout(() => {
                    if (this.copied === name) this.copied = "";
                }, 1600);
            } catch {
                this.error = "Clipboard access is unavailable. Select and copy the text instead.";
            }
        },
        downloadNonce() {
            const file = new Blob([`${this.nonce}\n`], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(file);
            const link = document.createElement("a");
            link.href = url;
            link.download = "nonce.txt";
            link.click();
            URL.revokeObjectURL(url);
        },
        startOver() {
            window.history.pushState({}, "", getBasePath());
            this.destination = "";
            this.nonce = "";
            this.error = "";
            this.copied = "";
            this.view = "home";
        }
    },
    template: `
        <main class="shell">
            <header class="topbar">
                <a class="wordmark" href="./" @click.prevent="startOver">
                    <span class="mark" aria-hidden="true">↗</span>
                    <span>relay<span class="wordmark-dot">.</span></span>
                </a>
                <span class="status"><i></i> CLIENT-SIDE ROUTING</span>
            </header>

            <section v-if="view === 'home'" class="workspace">
                <div class="eyebrow"><span>LINK UTILITY</span><span class="eyebrow-line"></span><span>01 / 01</span></div>
                <h1>One link.<br><span>One destination.</span></h1>
                <p class="intro">Create a redirect token from any web address.</p>

                <form class="entry-form" @submit.prevent="makeLink">
                    <label for="destination">DESTINATION URL</label>
                    <div class="input-row">
                        <span class="input-prefix" aria-hidden="true">↳</span>
                        <input id="destination" v-model="destination" type="url" placeholder="https://example.com/page" autocomplete="url" required>
                        <button class="primary-button" type="submit">Create link <span aria-hidden="true">↗</span></button>
                    </div>
                    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
                </form>

                <div class="format-note"><span class="note-mark">i</span><span>Only HTTP and HTTPS destinations are accepted.</span></div>
            </section>

            <section v-else-if="view === 'saved'" class="workspace result-view">
                <div class="eyebrow"><span>LINK CREATED</span><span class="eyebrow-line"></span><span>READY</span></div>
                <h1>Your link<br><span>is ready.</span></h1>
                <p class="intro destination-preview" :title="destination">{{ destination }}</p>

                <div class="result-list">
                    <div class="result-block">
                        <div class="result-heading"><label>REDIRECT LINK</label><span class="result-tag">SHARE</span></div>
                        <div class="result-value"><code>{{ clickUrl }}</code><button class="icon-button" type="button" :aria-label="copied === 'click' ? 'Copied' : 'Copy redirect link'" :title="copied === 'click' ? 'Copied' : 'Copy redirect link'" @click="copy(clickUrl, 'click')">{{ copied === 'click' ? '✓' : '⧉' }}</button></div>
                    </div>
                    <div class="result-block">
                        <div class="result-heading"><label>NONCE</label><span class="result-tag">BASE64URL</span></div>
                        <div class="result-value"><code>{{ nonce }}</code><button class="icon-button" type="button" :aria-label="copied === 'nonce' ? 'Copied' : 'Copy nonce'" :title="copied === 'nonce' ? 'Copied' : 'Copy nonce'" @click="copy(nonce, 'nonce')">{{ copied === 'nonce' ? '✓' : '⧉' }}</button></div>
                    </div>
                </div>

                <p v-if="error" class="error-message" role="alert">{{ error }}</p>
                <div class="result-actions">
                    <button class="text-button" type="button" @click="downloadNonce"><span aria-hidden="true">↓</span> Download nonce.txt</button>
                    <button class="text-button muted-button" type="button" @click="startOver">Create another <span aria-hidden="true">↗</span></button>
                </div>
            </section>

            <section v-else-if="view === 'redirecting'" class="workspace message-view">
                <span class="message-icon" aria-hidden="true">↗</span>
                <h1>Redirecting<span class="wordmark-dot">.</span></h1>
                <p class="intro">Taking you to the destination.</p>
            </section>

            <section v-else class="workspace message-view">
                <span class="message-icon error-icon" aria-hidden="true">!</span>
                <h1>Link unavailable<span class="wordmark-dot">.</span></h1>
                <p class="intro">{{ error }}</p>
                <button class="text-button back-button" type="button" @click="startOver">← Back to start</button>
            </section>

            <footer class="footer"><span>RELAY / STATIC LINK TOOL</span><span>NO SERVER-SIDE STORAGE</span></footer>
        </main>
    `
}).mount("#app");