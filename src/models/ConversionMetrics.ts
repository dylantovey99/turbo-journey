import mongoose, { Schema, Document } from 'mongoose';

export interface ConversionMetricsDocument extends Document {
  emailId: string;
  prospectId: string;
  campaignId: string;
  
  // Email performance
  sent: boolean;
  sentAt?: Date;
  opened: boolean;
  openedAt?: Date;
  clicked: boolean;
  clickedAt?: Date;
  replied: boolean;
  repliedAt?: Date;
  
  // Email characteristics
  subjectLine: string;
  subjectLineStyle: 'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof';
  emailLength: number;
  psychologicalTriggers: string[];
  personalizationElements: string[];
  
  // Context data
  industry: string;
  businessStage: string;
  professionalLevel: string;
  sendTime: Date;
  dayOfWeek: number;
  hourOfDay: number;
  
  // Response analysis (if available)
  responseAnalysis?: {
    type: string;
    sentiment: number;
    quality: number;
    engagement: number;
    keywords: string[];
    intent: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const ConversionMetricsSchema = new Schema({
  emailId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  prospectId: {
    type: String,
    required: true,
    index: true
  },
  campaignId: {
    type: String,
    required: true,
    index: true
  },
  
  // Email performance
  sent: { type: Boolean, default: false },
  sentAt: { type: Date },
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  clicked: { type: Boolean, default: false },
  clickedAt: { type: Date },
  replied: { type: Boolean, default: false },
  repliedAt: { type: Date },
  
  // Email characteristics
  subjectLine: { type: String, required: true },
  subjectLineStyle: {
    type: String,
    enum: ['curiosity', 'benefit', 'question', 'personalized', 'social-proof'],
    required: true
  },
  emailLength: { type: Number, required: true },
  psychologicalTriggers: [{ type: String }],
  personalizationElements: [{ type: String }],
  
  // Context data
  industry: { type: String, required: true },
  businessStage: { type: String, required: true },
  professionalLevel: { type: String, required: true },
  sendTime: { type: Date, required: true },
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  hourOfDay: { type: Number, required: true, min: 0, max: 23 },
  
  // Response analysis (optional)
  responseAnalysis: {
    type: { type: String },
    sentiment: { type: Number, min: -1, max: 1 },
    quality: { type: Number, min: 0, max: 1 },
    engagement: { type: Number, min: 0, max: 1 },
    keywords: [{ type: String }],
    intent: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

// Compound indexes for performance
ConversionMetricsSchema.index({ campaignId: 1, sentAt: -1 });
ConversionMetricsSchema.index({ industry: 1, businessStage: 1 });
ConversionMetricsSchema.index({ replied: 1, repliedAt: -1 });
ConversionMetricsSchema.index({ subjectLineStyle: 1 });
ConversionMetricsSchema.index({ psychologicalTriggers: 1 });

let _conversionMetricsModel: mongoose.Model<ConversionMetricsDocument> | null = null;

export const ConversionMetricsModel = {
  get model(): mongoose.Model<ConversionMetricsDocument> {
    if (!_conversionMetricsModel) {
      _conversionMetricsModel = mongoose.model<ConversionMetricsDocument>('ConversionMetrics', ConversionMetricsSchema);
    }
    return _conversionMetricsModel;
  },
  
  // Proxy all mongoose model methods
  find: (filter: any = {}, options?: any) => ConversionMetricsModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => ConversionMetricsModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => ConversionMetricsModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => ConversionMetricsModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => ConversionMetricsModel.model.findOneAndUpdate(filter, update, options),
  create: (doc: any) => ConversionMetricsModel.model.create(doc) as any,
  updateOne: (filter: any, update: any, options?: any) => ConversionMetricsModel.model.updateOne(filter, update, options),
  deleteOne: (filter: any, options?: any) => ConversionMetricsModel.model.deleteOne(filter, options),
  countDocuments: (filter: any = {}) => ConversionMetricsModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => ConversionMetricsModel.model.aggregate(pipeline),
};