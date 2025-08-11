import mongoose, { Schema, Document } from 'mongoose';
import { BulkImportJob, BulkImportStatus, BulkImportError } from '@/types';

export interface BulkImportJobDocument extends Document {
  filename: string;
  campaignId?: string;
  totalProspects: number;
  successfulProspects: number;
  failedProspects: number;
  status: string;
  importErrors: BulkImportError[];
}

const BulkImportErrorSchema = new Schema({
  row: { type: Number, required: true },
  error: { type: String, required: true },
  data: { type: Schema.Types.Mixed }
}, { _id: false });

const BulkImportJobSchema = new Schema({
  filename: {
    type: String,
    required: true
  },
  totalProspects: {
    type: Number,
    required: true,
    min: 0
  },
  processedProspects: {
    type: Number,
    default: 0,
    min: 0
  },
  successfulProspects: {
    type: Number,
    default: 0,
    min: 0
  },
  failedProspects: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(BulkImportStatus),
    default: BulkImportStatus.PENDING
  },
  importErrors: [BulkImportErrorSchema]
}, {
  timestamps: true,
  toJSON: { transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; } }
});

BulkImportJobSchema.index({ status: 1 });
BulkImportJobSchema.index({ createdAt: -1 });

let _bulkImportJobModel: mongoose.Model<BulkImportJobDocument> | null = null;

export const BulkImportJobModel = {
  get model(): mongoose.Model<BulkImportJobDocument> {
    if (!_bulkImportJobModel) {
      _bulkImportJobModel = mongoose.model<BulkImportJobDocument>('BulkImportJob', BulkImportJobSchema);
    }
    return _bulkImportJobModel;
  },
  
  // Proxy all mongoose model methods and properties
  find: (filter: any = {}, options?: any) => BulkImportJobModel.model.find(filter, options),
  findById: (id: any, projection?: any, options?: any) => BulkImportJobModel.model.findById(id, projection, options),
  findOne: (filter: any = {}, projection?: any, options?: any) => BulkImportJobModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: any, update: any, options?: any) => BulkImportJobModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: any, update: any, options?: any) => BulkImportJobModel.model.findOneAndUpdate(filter, update, options),
  findByIdAndDelete: (id: any, options?: any) => BulkImportJobModel.model.findByIdAndDelete(id, options),
  findOneAndDelete: (filter: any, options?: any) => BulkImportJobModel.model.findOneAndDelete(filter, options),
  create: (doc: any) => BulkImportJobModel.model.create(doc) as any,
  insertMany: (docs: any[], options?: any) => BulkImportJobModel.model.insertMany(docs, options),
  updateOne: (filter: any, update: any, options?: any) => BulkImportJobModel.model.updateOne(filter, update, options),
  updateMany: (filter: any, update: any, options?: any) => BulkImportJobModel.model.updateMany(filter, update, options),
  deleteOne: (filter: any, options?: any) => BulkImportJobModel.model.deleteOne(filter, options),
  deleteMany: (filter: any, options?: any) => BulkImportJobModel.model.deleteMany(filter, options),
  countDocuments: (filter: any = {}) => BulkImportJobModel.model.countDocuments(filter),
  aggregate: (pipeline: any[]) => BulkImportJobModel.model.aggregate(pipeline),
  distinct: (field: string, filter?: any) => BulkImportJobModel.model.distinct(field, filter),
  exists: (filter: any) => BulkImportJobModel.model.exists(filter),
  estimatedDocumentCount: () => BulkImportJobModel.model.estimatedDocumentCount(),
};