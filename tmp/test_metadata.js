const fetch = global.fetch || require('node-fetch');

async function testMetadata() {
    const title = "The Beginning After The End";
    const url = `http://localhost:5000/api/proxy/metadata?title=${encodeURIComponent(title)}`;

    // We need a token since it's authenticated
    // For local testing, I'll bypass it if I can or just mock a guest token
    // Actually, I'll just check if the server logs show the enrichment.
    // Or I can just call the fetchBest function directly in a script.

    console.log(`Testing Metadata for: ${title}`);
    try {
        const res = await fetch(url);
        // It will fail because of no token. 
        // Let's create a script that imports metadataProxy and runs fetchBest.
    } catch (e) {
        console.error(e);
    }
}
