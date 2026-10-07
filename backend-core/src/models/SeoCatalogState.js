import mongoose from 'mongoose';

const SeoCatalogStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'global' },
  revision: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

export default mongoose.models.SeoCatalogState || mongoose.model('SeoCatalogState', SeoCatalogStateSchema);
