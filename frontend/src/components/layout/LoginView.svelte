<script lang="ts">
    import { onMount } from 'svelte';
    import { Button, FormRow, Icon, TextInput } from '../ui';
    import LExternalLink from '@lucide/svelte/icons/external-link';
    import AboutVersions from '../settings/AboutVersions.svelte';
    import { getLoginOptions, login, loginWithGoogle, swarmRoot, type LoginProvider } from '../../lib/api/client';

    let { onsuccess }: { onsuccess: () => void } = $props();
    let username = $state('');
    let password = $state('');
    let error = $state('');
    let busy = $state(false);
    let passwordLogin = $state(true);
    let providers = $state<LoginProvider[]>([]);
    let swarmVersion = $state('');

    onMount(() => {
        getLoginOptions().then((o) => {
            passwordLogin = o.password;
            providers = o.providers;
            swarmVersion = o.swarmVersion;
        });
    });

    async function submit() {
        const name = username.trim();
        if (name.length < 3) {
            error = 'Please enter a valid username.';
            return;
        }
        if (password.length < 8) {
            error = 'Please enter a valid password.';
            return;
        }
        busy = true;
        error = '';
        try {
            const data = await login(name, password);
            if (data.success) {
                onsuccess();
                return;
            }
            if (data.error_id === 'invalid_login') error = 'Login failed (incorrect username or password), please check your inputs and try again.';
            else if (data.error_id === 'ratelimit') error = 'Login failed (ratelimit reached), please wait a minute before trying again.';
            else error = 'Login failed (reason unknown), please check your inputs and try again.';
        }
        catch {
            error = 'Login failed (reason unknown), please check your inputs and try again.';
        }
        busy = false;
    }

    type Gsi = { accounts: { id: { initialize(o: object): void; prompt(): void } } };
    function gsi(): Gsi | undefined {
        return (window as unknown as { google?: Gsi }).google;
    }
    function loadGsi(): Promise<Gsi> {
        const existing = gsi();
        if (existing) return Promise.resolve(existing);
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://accounts.google.com/gsi/client';
            s.async = true;
            s.onload = () => {
                const g = gsi();
                if (g) resolve(g);
                else reject(new Error('Google sign-in failed to load.'));
            };
            s.onerror = () => reject(new Error('Could not load Google sign-in.'));
            document.head.appendChild(s);
        });
    }

    async function oauth(p: LoginProvider) {
        if (p.id !== 'google') return;
        busy = true;
        error = '';
        try {
            const g = await loadGsi();
            await new Promise<void>((resolve, reject) => {
                g.accounts.id.initialize({
                    client_id: p.clientId,
                    ux_mode: 'popup',
                    callback: async (resp: { credential?: string }) => {
                        try {
                            if (!resp.credential) {
                                reject(new Error('Google sign-in failed.'));
                                return;
                            }
                            const r = await loginWithGoogle(resp.credential);
                            if (r.success) {
                                onsuccess();
                                resolve();
                                return;
                            }
                            reject(new Error(r.error ?? 'Google sign-in failed.'));
                        }
                        catch (e) {
                            reject(e instanceof Error ? e : new Error('Google sign-in failed.'));
                        }
                    },
                });
                g.accounts.id.prompt();
            });
        }
        catch (e) {
            error = e instanceof Error ? e.message : 'Google sign-in failed.';
            busy = false;
        }
    }
</script>

<h2>Sign in</h2>
<form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    {#if passwordLogin}
        <FormRow label="Username">
            <TextInput bind:value={username} autocomplete="username" autocapitalize="off" spellcheck={false} aria-label="Username" autofocus disabled={busy} />
        </FormRow>
        <FormRow label="Password">
            <TextInput type="password" bind:value={password} autocomplete="current-password" aria-label="Password" disabled={busy} />
        </FormRow>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
    {#if passwordLogin}
        <div class="ui-group-btns" role="group">
            <Button variant="primary" class="gen-btn" type="submit" disabled={busy} loading={busy} block>Log in</Button>
        </div>
    {/if}
    {#each providers as p (p.id)}
        <div class="ui-group-btns" role="group">
            <Button class="gen-btn" type="button" disabled={busy} loading={busy} block onclick={() => oauth(p)}>{p.label}</Button>
        </div>
    {/each}
</form>
<div class="aha-acts ui-dense">
    <div class="sp"><AboutVersions {swarmVersion} /></div>
    <a class="ctl" href="{swarmRoot}Register"><Icon icon={LExternalLink} />Register</a>
</div>

<style>
    form { display: flex; flex-direction: column; gap: var(--space-3); }
    p { margin: 0; }
    .ui-group-btns { display: flex; width: 100%; }
</style>
