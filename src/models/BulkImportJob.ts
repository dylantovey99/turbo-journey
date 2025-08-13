import mongoose, { Schema, Document, FilterQuery, UpdateQuery, QueryOptions, CreateOptions } from 'mongoose';
import { BulkImportStatus, BulkImportError } from '@/types';

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
  
  // Proxy all mongoose model methods and properties with proper typing
  find: (filter: FilterQuery<BulkImportJobDocument> = {}, options?: QueryOptions) => BulkImportJobModel.model.find(filter, options),
  findById: (id: string, projection?: string | Record<string, unknown>, options?: QueryOptions) => BulkImportJobModel.model.findById(id, projection, options),
  findOne: (filter: FilterQuery<BulkImportJobDocument> = {}, projection?: string | Record<string, unknown>, options?: QueryOptions) => BulkImportJobModel.model.findOne(filter, projection, options),
  findByIdAndUpdate: (id: string, update: UpdateQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.findByIdAndUpdate(id, update, options),
  findOneAndUpdate: (filter: FilterQuery<BulkImportJobDocument>, update: UpdateQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.findOneAndUpdate(filter, update, options),
  findByIdAndDelete: (id: string, options?: QueryOptions) => BulkImportJobModel.model.findByIdAndDelete(id, options),
  findOneAndDelete: (filter: FilterQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.findOneAndDelete(filter, options),
  create: (doc: Partial<BulkImportJobDocument>, options?: CreateOptions) => BulkImportJobModel.model.create(doc, options),
  insertMany: (docs: Partial<BulkImportJobDocument>[], options?: mongoose.InsertManyOptions) => BulkImportJobModel.model.insertMany(docs, options),
  updateOne: (filter: FilterQuery<BulkImportJobDocument>, update: UpdateQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.updateOne(filter, update, options),
  updateMany: (filter: FilterQuery<BulkImportJobDocument>, update: UpdateQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.updateMany(filter, update, options),
  deleteOne: (filter: FilterQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.deleteOne(filter, options),
  deleteMany: (filter: FilterQuery<BulkImportJobDocument>, options?: QueryOptions) => BulkImportJobModel.model.deleteMany(filter, options),
  countDocuments: (filter: FilterQuery<BulkImportJobDocument> = {}) => BulkImportJobModel.model.countDocuments(filter),
  aggregate: (pipeline: mongoose.PipelineStage[]) => BulkImportJobModel.model.aggregate(pipeline),
  distinct: (field: string, filter?: FilterQuery<BulkImportJobDocument>) => BulkImportJobModel.model.distinct(field, filter),
  exists: (filter: FilterQuery<BulkImportJobDocument>) => BulkImportJobModel.model.exists(filter),
  estimatedDocumentCount: () => BulkImportJobModel.model.estimatedDocumentCount(),
};