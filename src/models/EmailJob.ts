import mongoose, { Schema, Document } from 'mongoose';
import { EmailJob, JobStatus, GeneratedEmail } from '@/types';

export interface EmailJobDocument extends Omit<EmailJob, 'id'>, Document {}

const GeneratedEmailSchema = new Schema({
  subject: { type: String, required: true },
  htmlBody: { type: String, required: true },
  textBody: { type: String, required: true },
  personalizations: [{ type: String }],
  confidence: { type: Number, min: 0, max: 1 }
}, { _id: false });

const EmailJobSchema = new Schema({
  prospectId: {
    type: Schema.Types.ObjectId,
    ref: 'Prospect',
    required: true
  },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(JobStatus),
    default: JobStatus.QUEUED
  },
  generatedEmail: GeneratedEmailSchema,
  missiveDraftId: {
    type: String
  },
  error: {
    type: String
  },
  attempts: {
    type: Number,
    default: 0
  },
  response: {
    text: { type: String },
    analysis: {
      type: { type: String, enum: ['positive', 'negative', 'neutral', 'meeting_request', 'objection', 'referral', 'out_of_office', 'unsubscribe'] },
      sentiment: { type: Number, min: -1, max: 1 },
      quality: { type: Number, min: 0, max: 1 },
      engagement: { type: Number, min: 0, max: 1 },
      keywords: [{ type: String }],
      intent: { type: String },
      followUpSuggestion: { type: String }
    },
    metadata: {
      timestamp: { type: Date },
      fromEmail: { type: String },
      subject: { type: String }
    },
    analyzedAt: { type: Date }
  },
  learning: {
    prospectType: { type: String },
    emailStyle: { type: String },
    responseQuality: { type: Number, min: 0, max: 1 },
    insights: [{ type: String }],
    improvementSuggestions: [{ type: String }],
    updatedAt: { type: Date }
  },
  analytics: {
    sentAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    repliedAt: { type: Date },
    opened: { type: Boolean, default: false },
    clicked: { type: Boolean, default: false },
    replied: { type: Boolean, default: false },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 },
    subjectLineStyle: { type: String },
    psychologicalTriggers: [{ type: String }],
    industry: { type: String },
    businessStage: { type: String },
    marketPosition: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

EmailJobSchema.index({ prospectId: 1, campaignId: 1 }, { unique: true });
EmailJobSchema.index({ status: 1 });
EmailJobSchema.index({ createdAt: -1 });
EmailJobSchema.index({ campaignId: 1, status: 1 });

let _emailJobModel: mongoose.Model<EmailJobDocument> | null = null;

export const EmailJobModel = {
  get model(): mongoose.Model<EmailJobDocument> {
    if (!_emailJobModel) {
      _emailJobModel = mongoose.model<EmailJobDocument>('EmailJob', EmailJobSchema);
    }
    return _emailJobModel;
  },
  
  // Proxy all mongoose model methods and properties
  find: (filter: any = {}, options?: any) => EmailJobModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => EmailJobModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => EmailJobModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => EmailJobModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => EmailJobModel.model.findOneAndUpdate(filter, update, options),
  findByIdAndDelete: (id: any, options?: any) => EmailJobModel.model.findByIdAndDelete(id, options),
  findOneAndDelete: (filter: any, options?: any) => EmailJobModel.model.findOneAndDelete(filter, options),
  create: (doc: any) => EmailJobModel.model.create(doc) as any,
  insertMany: (docs: any[], options?: any) => EmailJobModel.model.insertMany(docs, options),
  updateOne: (filter: any, update: any, options?: any) => EmailJobModel.model.updateOne(filter, update, options),
  updateMany: (filter: any, update: any, options?: any) => EmailJobModel.model.updateMany(filter, update, options),
  deleteOne: (filter: any, options?: any) => EmailJobModel.model.deleteOne(filter, options),
  deleteMany: (filter: any, options?: any) => EmailJobModel.model.deleteMany(filter, options),
  countDocuments: (filter: any = {}) => EmailJobModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => EmailJobModel.model.aggregate(pipeline),
  distinct: (field: string, filter?: any) => EmailJobModel.model.distinct(field, filter),
  exists: (filter: any) => EmailJobModel.model.exists(filter),
  estimatedDocumentCount: () => EmailJobModel.model.estimatedDocumentCount(),
  populate: (docs: any, options: any) => EmailJobModel.model.populate(docs, options),
};