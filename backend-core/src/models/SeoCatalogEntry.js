import mongoose from 'mongoose';

const EpisodeSchema = new mongoose.Schema({
  number: { type: Number, required: true, min: 0, max: 100000 },
  title: { type: String, default: null, maxlength: 256 },
  description: { type: String, default: null, maxlength: 1000 },
  thumbnail: { type: String, default: null, maxlength: 2048 },
  duration: { type: Number, default: null, min: 1, max: 1440 },
  airDate: { type: Date, default: null },
  available: { type: Boolean, default: true },
  uniqueMetadata: { type: Boolean, default: false },
  updatedAt: { type: Date, default: null },
}, { _id: false });

const CharacterSchema = new mongoose.Schema({
  id: { type: String, default: null, maxlength: 128 },
  names: { type: [String], default: [] },
  aliases: { type: [String], default: [] },
  image: { type: String, default: null, maxlength: 2048 },
}, { _id: false });

const SeoCatalogEntrySchema = new mongoose.Schema({
  canonicalId: { type: String, required: true, unique: true, index: true, maxlength: 128 },
  slug: { type: String, required: true, unique: true, index: true, maxlength: 120 },
  canonicalUrl: { type: String, required: true, maxlength: 256 },
  providerIds: {
    anilist: { type: String, default: null },
    mal: { type: String, default: null },
    kitsu: { type: String, default: null },
    aniZip: { type: String, default: null },
  },
  titles: {
    canonical: { type: String, required: true, maxlength: 256 },
    english: { type: String, default: null, maxlength: 256 },
    romaji: { type: String, default: null, maxlength: 256 },
    native: { type: String, default: null, maxlength: 256 },
    userPreferred: { type: String, default: null, maxlength: 256 },
    synonyms: { type: [String], default: [] },
    localized: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  searchAliases: { type: [String], default: [] },
  format: { type: String, required: true, index: true },
  season: { type: String, default: null },
  seasonNumber: { type: Number, default: null, min: 1, max: 1000 },
  seasonYear: { type: Number, default: null, index: true },
  part: { type: Number, default: null },
  description: { type: String, default: null, maxlength: 3000 },
  image: { type: String, default: null, maxlength: 2048 },
  bannerImage: { type: String, default: null, maxlength: 2048 },
  episodeCount: { type: Number, default: null, min: 0, max: 100000 },
  episodes: { type: [EpisodeSchema], default: [] },
  characters: { type: [CharacterSchema], default: [] },
  characterAliases: { type: [String], default: [] },
  metadataState: { type: String, enum: ['complete', 'partial', 'stale', 'error'], default: 'partial', index: true },
  indexable: { type: Boolean, default: true, index: true },
  revision: { type: Number, default: 1, min: 1 },
  lastFetchedAt: { type: Date, default: Date.now, index: true },
  contentUpdatedAt: { type: Date, default: Date.now },
  lastEpisodeUpdatedAt: { type: Date, default: null, index: true },
}, { timestamps: true, minimize: false });

SeoCatalogEntrySchema.index(
  { 'providerIds.anilist': 1 },
  { unique: true, partialFilterExpression: { 'providerIds.anilist': { $type: 'string' } } },
);
SeoCatalogEntrySchema.index(
  { 'providerIds.mal': 1 },
  { unique: true, partialFilterExpression: { 'providerIds.mal': { $type: 'string' } } },
);
SeoCatalogEntrySchema.index({ searchAliases: 1 });
SeoCatalogEntrySchema.index({ characterAliases: 1 });
SeoCatalogEntrySchema.index({ indexable: 1, metadataState: 1, lastFetchedAt: -1 });

export default mongoose.models.SeoCatalogEntry || mongoose.model('SeoCatalogEntry', SeoCatalogEntrySchema);
