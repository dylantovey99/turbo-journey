import mongoose, { Schema, Document } from 'mongoose';

export interface LearningModelDocument extends Document {
  prospectType: string;
  totalResponses: number;
  averageQuality: number;
  stylePerformance: Array<{
    style: string;
    successRate: number;
    confidence: number;
    responseCount: number;
  }>;
  contentRecommendations: Array<{
    recommendation: string;
    successRate: number;
    usageCount: number;
  }>;
  commonChallenges: Array<{
    challenge: string;
    frequency: number;
    resolutionRate: number;
  }>;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LearningModelSchema = new Schema({
  prospectType: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  totalResponses: {
    type: Number,
    default: 0
  },
  averageQuality: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  stylePerformance: [{
    style: { type: String, required: true },
    successRate: { type: Number, required: true, min: 0, max: 1 },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    responseCount: { type: Number, required: true, default: 0 },
    _id: false
  }],
  contentRecommendations: [{
    recommendation: { type: String, required: true },
    successRate: { type: Number, required: true, min: 0, max: 1 },
    usageCount: { type: Number, required: true, default: 0 },
    _id: false
  }],
  commonChallenges: [{
    challenge: { type: String, required: true },
    frequency: { type: Number, required: true, default: 0 },
    resolutionRate: { type: Number, required: true, min: 0, max: 1 },
    _id: false
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

// Indexes for better query performance
LearningModelSchema.index({ prospectType: 1 });
LearningModelSchema.index({ lastUpdated: -1 });
LearningModelSchema.index({ totalResponses: -1 });

let _learningModelModel: mongoose.Model<LearningModelDocument> | null = null;

export const LearningModelModel = {
  get model(): mongoose.Model<LearningModelDocument> {
    if (!_learningModelModel) {
      _learningModelModel = mongoose.model<LearningModelDocument>('LearningModel', LearningModelSchema);
    }
    return _learningModelModel;
  },
  
  // Proxy all mongoose model methods
  find: (filter: any = {}, options?: any) => LearningModelModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => LearningModelModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => LearningModelModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => LearningModelModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => LearningModelModel.model.findOneAndUpdate(filter, update, options),
  create: (doc: any) => LearningModelModel.model.create(doc) as any,
  updateOne: (filter: any, update: any, options?: any) => LearningModelModel.model.updateOne(filter, update, options),
  deleteOne: (filter: any, options?: any) => LearningModelModel.model.deleteOne(filter, options),
  countDocuments: (filter: any = {}) => LearningModelModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => LearningModelModel.model.aggregate(pipeline),
};