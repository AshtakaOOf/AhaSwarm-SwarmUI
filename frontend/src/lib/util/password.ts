// classic doPasswordClientPrehash, the server hashes again; this only keeps the raw password off the wire
export async function prehashPassword(userId: string, pw: string): Promise<string> {
    const str = `swarmclientpw:${userId}:${pw}`;
    try {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    catch {
        // crypto.subtle is missing outside https, so the server prehashes instead
        return `__swarmdoprehash:${str}`;
    }
}
