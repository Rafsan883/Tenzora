import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  animeId: {
    type: String,
    required: true
  },
  anilistId: Number,
  idMal: Number,
  isMAL: { type: Boolean, default: false },
  episode: {
    type: Number,
    required: true
    , min: 1
  },
  currentTime: {
    type: Number,
    required: true
    , min: 0
  },
  duration: {
    type: Number, min: 0
  },
  title: {
    type: String,
    required: true
  },
  coverImage: {
    type: String
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

progressSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

progressSchema.index({ user: 1, animeId: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);
export default Progress;
