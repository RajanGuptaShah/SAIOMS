/**
 * SAIOMS — Animal Mongoose Schema
 * Mirrors the Python Pydantic AnimalDocument model.
 */
const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const VaccinationSchema = new Schema({
    vaccine: { type: String, required: true },
    date: { type: String, required: true },
    next_due: String,
    vet_name: String,
    clinic: String,
    notes: String,
}, { _id: false });

const TransferHistorySchema = new Schema({
    from_owner: String,
    from_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    from_email: String,
    from_phone: String,
    from_city: String,
    from_state: String,
    to_owner: String,
    to_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    to_email: String,
    to_phone: String,
    date: String,
    reason: String,
}, { _id: false });

const AnimalSchema = new Schema({
    // Identity
    animal_id: { type: String, required: true, unique: true, index: true },
    qr_id: { type: String, required: true, unique: true, index: true },
    qr_path: String,

    // Owner
    owner_user_id: { type: ObjectId, ref: 'User', index: true }, // linked user account
    owner_name: { type: String, required: true },
    owner_phone: { type: String, required: true, index: true },
    owner_email: String,
    owner_aadhaar: String,
    pincode: String,
    city: String,
    district: { type: String, index: true },
    state: String,

    // Animal
    species: { type: String, enum: ['cattle', 'buffalo'], default: 'cattle' },
    breed: { type: String, index: true },
    gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
    dob: String,
    color_markings: String,
    weight_kg: Number,
    ear_tag: String,

    // Health
    health_status: { type: String, enum: ['healthy', 'sick', 'under_treatment', 'unknown'], default: 'healthy', index: true },
    vaccinations: [VaccinationSchema],
    last_vet_visit: String,
    notes: String,

    // AI Results
    ai_breed: String,
    ai_confidence: Number,

    // Transfer history
    transfer_history: [TransferHistorySchema],
}, {
    timestamps: { createdAt: 'registered_at', updatedAt: 'updated_at' },
});

// Remove MongoDB _id from JSON output
AnimalSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Animal', AnimalSchema);
