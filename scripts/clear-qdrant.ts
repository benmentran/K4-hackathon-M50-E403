/**
 * Clear Qdrant collections.
 * Run: ./node_modules/.bin/tsx scripts/clear-qdrant.ts
 */

// Load .env.local
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" })
} catch { /* ignore */ }

import { QdrantClient } from "@qdrant/js-client-rest"

async function main() {
  const url = process.env.QDRANT_URL
  const apiKey = process.env.QDRANT_API_KEY

  if (!url || !apiKey) {
    console.error("Missing QDRANT_URL or QDRANT_API_KEY")
    process.exit(1)
  }

  const client = new QdrantClient({ url, apiKey, checkCompatibility: false })

  // Delete all points from both collections
  const collections = ["slides", "transcripts"]
  for (const name of collections) {
    const exists = await client.collectionExists(name)
    if (exists) {
      // Delete collection entirely (simpler than deleting all points)
      await client.deleteCollection(name)
      console.log(`✓ Deleted collection: ${name}`)

      // Recreate empty
      await client.createCollection(name, {
        vectors: { size: 1536, distance: "Cosine" },
        optimizers_config: { default_segment_number: 2 },
      })
      if (name === "slides") {
        await client.createPayloadIndex(name, { field_name: "page", field_schema: "integer" })
        await client.createPayloadIndex(name, { field_name: "deck_id", field_schema: "keyword" })
      } else {
        await client.createPayloadIndex(name, { field_name: "page", field_schema: "integer" })
        await client.createPayloadIndex(name, { field_name: "deck_id", field_schema: "keyword" })
        await client.createPayloadIndex(name, { field_name: "speaker", field_schema: "keyword" })
      }
      console.log(`✓ Recreated collection: ${name}`)
    }
  }

  console.log("\n✅ Clear complete!")
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
