import mongoose, { Schema, Document } from 'mongoose';
import { Prospect, ProspectStatus, ScrapedData } from '@/types';

export interface ProspectDocument extends Omit<Prospect, 'id'>, Document {}

const ContactInfoSchema = new Schema({
  email: { type: String },
  phone: { type: String },
  address: { type: String },
  socialMedia: { type: Map, of: String }
}, { _id: false });

const ScrapedDataSchema = new Schema({
  title: { type: String },
  description: { type: String },
  services: [{ type: String }],
  technologies: [{ type: String }],
  recentNews: [{ type: String }],
  contactInfo: ContactInfoSchema,
  metadata: { type: Schema.Types.Mixed }
}, { _id: false });

const LastErrorSchema = new Schema({
  message: { type: String },
  type: { type: String },
  retryable: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now },
  retryCount: { type: Number, default: 0 }
}, { _id: false });

const ProspectSchema = new Schema({
  website: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contactEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contactName: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  industry: {
    type: String,
    trim: true
  },
  scrapedData: ScrapedDataSchema,
  status: {
    type: String,
    enum: Object.values(ProspectStatus),
    default: ProspectStatus.PENDING
  },
  campaignIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  }],
  assignedAt: {
    type: Date,
    default: Date.now
  },
  lastError: LastErrorSchema,
  retryCount: {
    type: Number,
    default: 0
  },
  lastAttemptedAt: {
    type: Date
  },
  successfullyScrapedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

ProspectSchema.index({ website: 1 }, { unique: true });
ProspectSchema.index({ contactEmail: 1 });
ProspectSchema.index({ status: 1 });
ProspectSchema.index({ createdAt: -1 });
ProspectSchema.index({ campaignIds: 1 });
ProspectSchema.index({ campaignIds: 1, status: 1 });
ProspectSchema.index({ assignedAt: -1 });
ProspectSchema.index({ 'lastError.retryable': 1, 'lastError.retryCount': 1 });
ProspectSchema.index({ retryCount: 1 });
ProspectSchema.index({ lastAttemptedAt: -1 });

let _prospectModel: mongoose.Model<ProspectDocument> | null = null;

export const ProspectModel = {
  get model(): mongoose.Model<ProspectDocument> {
    if (!_prospectModel) {
      _prospectModel = mongoose.model<ProspectDocument>('Prospect', ProspectSchema);
    }
    return _prospectModel;
  },
  
  // Proxy all mongoose model methods and properties
  find: (filter: any = {}, options?: any) => ProspectModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => ProspectModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => ProspectModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => ProspectModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => ProspectModel.model.findOneAndUpdate(filter, update, options),
  findByIdAndDelete: (id: any, options?: any) => ProspectModel.model.findByIdAndDelete(id, options),
  findOneAndDelete: (filter: any, options?: any) => ProspectModel.model.findOneAndDelete(filter, options),
  create: (doc: any) => ProspectModel.model.create(doc) as any,
  insertMany: (docs: any[], options?: any) => ProspectModel.model.insertMany(docs, options),
  updateOne: (filter: any, update: any, options?: any) => ProspectModel.model.updateOne(filter, update, options),
  updateMany: (filter: any, update: any, options?: any) => ProspectModel.model.updateMany(filter, update, options),
  deleteOne: (filter: any, options?: any) => ProspectModel.model.deleteOne(filter, options),
  deleteMany: (filter: any, options?: any) => ProspectModel.model.deleteMany(filter, options),
  countDocuments: (filter: any = {}) => ProspectModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => ProspectModel.model.aggregate(pipeline),
  distinct: (field: string, filter?: any) => ProspectModel.model.distinct(field, filter),
  exists: (filter: any) => ProspectModel.model.exists(filter),
  estimatedDocumentCount: () => ProspectModel.model.estimatedDocumentCount(),
  get collection() { return ProspectModel.model.collection; },
};