import mongoose, { Schema, Document } from 'mongoose';
import { Campaign, CampaignStatus, EmailTone, EmailStyle } from '@/types';

export interface CampaignDocument extends Omit<Campaign, 'id'>, Document {}

const CampaignSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  marketingDocument: {
    type: String,
    required: true
  },
  emailTemplate: {
    type: String
  },
  usps: [{
    type: String,
    required: true
  }],
  targetAudience: {
    type: String,
    trim: true
  },
  tone: {
    type: String,
    enum: Object.values(EmailTone),
    default: EmailTone.PROFESSIONAL
  },
  emailStyle: {
    type: String,
    enum: Object.values(EmailStyle),
    default: EmailStyle.STATEMENT
  },
  missiveAccountId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT
  }
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

CampaignSchema.index({ name: 1 });
CampaignSchema.index({ status: 1 });
CampaignSchema.index({ createdAt: -1 });

let _campaignModel: mongoose.Model<CampaignDocument> | null = null;

export const CampaignModel = {
  get model(): mongoose.Model<CampaignDocument> {
    if (!_campaignModel) {
      _campaignModel = mongoose.model<CampaignDocument>('Campaign', CampaignSchema);
    }
    return _campaignModel;
  },
  
  // Proxy all mongoose model methods and properties
  find: (filter: any = {}, options?: any) => CampaignModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => CampaignModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => CampaignModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => CampaignModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => CampaignModel.model.findOneAndUpdate(filter, update, options),
  findByIdAndDelete: (id: any, options?: any) => CampaignModel.model.findByIdAndDelete(id, options),
  findOneAndDelete: (filter: any, options?: any) => CampaignModel.model.findOneAndDelete(filter, options),
  create: (doc: any) => CampaignModel.model.create(doc) as any,
  insertMany: (docs: any[], options?: any) => CampaignModel.model.insertMany(docs, options),
  updateOne: (filter: any, update: any, options?: any) => CampaignModel.model.updateOne(filter, update, options),
  updateMany: (filter: any, update: any, options?: any) => CampaignModel.model.updateMany(filter, update, options),
  deleteOne: (filter: any, options?: any) => CampaignModel.model.deleteOne(filter, options),
  deleteMany: (filter: any, options?: any) => CampaignModel.model.deleteMany(filter, options),
  countDocuments: (filter: any = {}) => CampaignModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => CampaignModel.model.aggregate(pipeline),
  distinct: (field: string, filter?: any) => CampaignModel.model.distinct(field, filter),
  exists: (filter: any) => CampaignModel.model.exists(filter),
  estimatedDocumentCount: () => CampaignModel.model.estimatedDocumentCount(),
};