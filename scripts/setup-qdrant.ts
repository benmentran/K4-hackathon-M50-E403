/**
 * Setup Qdrant collections for VLearn.
 * Run: npx tsx scripts/setup-qdrant.ts
 */

// Load .env.local
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" })
} catch { /* ignore */ }

import { QdrantClient } from "@qdrant/js-client-rest"

const VECTOR_SIZE = 1536 // text-embedding-3-small
const DISTANCE = "Cosine"

async function main() {
  const url = process.env.QDRANT_URL
  const apiKey = process.env.QDRANT_API_KEY

  if (!url || !apiKey) {
    console.error("Missing QDRANT_URL or QDRANT_API_KEY in .env.local")
    console.error(`  QDRANT_URL=${url}`)
    console.error(`  QDRANT_API_KEY=${apiKey ? "(set)" : "(missing)"}`)
    process.exit(1)
  }

  const client = new QdrantClient({ url, apiKey, checkCompatibility: false })

  // Collection 1: Slides (per-deck, page-scoped retrieval)
  const slidesCollection = "slides"
  console.log(`\n📄 Setting up collection: ${slidesCollection}`)
  const slidesExists = await client.collectionExists(slidesCollection)
  if (slidesExists) {
    console.log(`   ✓ Collection '${slidesCollection}' already exists`)
  } else {
    await client.createCollection(slidesCollection, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE },
      optimizers_config: { default_segment_number: 2 },
    })
    console.log(`   ✓ Created collection '${slidesCollection}'`)

    // Create payload index for page filtering
    await client.createPayloadIndex(slidesCollection, {
      field_name: "page",
      field_schema: "integer",
    })
    await client.createPayloadIndex(slidesCollection, {
      field_name: "deck_id",
      field_schema: "keyword",
    })
    console.log(`   ✓ Added payload indexes (page, deck_id)`)
  }

  // Collection 2: Transcripts (instructor/student utterances, page-mapped)
  const transcriptsCollection = "transcripts"
  console.log(`\n🎙️  Setting up collection: ${transcriptsCollection}`)
  const transcriptsExists = await client.collectionExists(transcriptsCollection)
  if (transcriptsExists) {
    console.log(`   ✓ Collection '${transcriptsCollection}' already exists`)
  } else {
    await client.createCollection(transcriptsCollection, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE },
      optimizers_config: { default_segment_number: 2 },
    })
    console.log(`   ✓ Created collection '${transcriptsCollection}'`)

    // Create payload indexes
    await client.createPayloadIndex(transcriptsCollection, {
      field_name: "page",
      field_schema: "integer",
    })
    await client.createPayloadIndex(transcriptsCollection, {
      field_name: "deck_id",
      field_schema: "keyword",
    })
    await client.createPayloadIndex(transcriptsCollection, {
      field_name: "speaker",
      field_schema: "keyword",
    })
    console.log(`   ✓ Added payload indexes (page, deck_id, speaker)`)
  }

  // Verify
  console.log("\n📊 Collections summary:")
  const collections = await client.getCollections()
  for (const col of collections.collections) {
    const info = await client.getCollection(col.name)
    const points = await client.getScroll(col.name, { with_payload: false, limit: 1 })
    console.log(`   - ${col.name}: ${info.points_count ?? info.vectors_count ?? 0} vectors`)
  }

  console.log("\n✅ Qdrant setup complete!")
}

main().catch((err) => {
  console.error("Setup failed:", err)
  process.exit(1)
})
