/**
 * SAIOMS — Stats Router
 * GET /api/stats — Public stats for the homepage (live from DB)
 */
const express = require('express');
const Animal = require('../models/Animal');
const User = require('../models/User');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const [totalAnimals, totalUsers, speciesCounts, healthStats, breedDetections, totalTransfers] = await Promise.all([
            Animal.countDocuments(),
            User.countDocuments(),
            Animal.aggregate([{ $group: { _id: '$species', count: { $sum: 1 } } }]),
            Animal.aggregate([{ $group: { _id: '$health_status', count: { $sum: 1 } } }]),
            Animal.countDocuments({ ai_breed: { $exists: true, $ne: null, $ne: '' } }),
            Animal.aggregate([{ $project: { transfers: { $size: { $ifNull: ['$transfer_history', []] } } } }, { $group: { _id: null, total: { $sum: '$transfers' } } }]),
        ]);

        const districts = await Animal.distinct('district');
        const breeds = await Animal.distinct('breed');
        const recentAnimals = await Animal.find().sort({ registered_at: -1 }).limit(5).lean().then(docs =>
            docs.map(({ _id, __v, owner_user_id, ...rest }) => ({
                animal_id: rest.animal_id,
                species: rest.species,
                breed: rest.breed,
                district: rest.district,
                state: rest.state,
                health_status: rest.health_status,
                registered_at: rest.registered_at,
            }))
        );

        res.json({
            success: true,
            totalAnimals,
            totalUsers,
            totalTransfers: totalTransfers[0]?.total || 0,
            totalBreedDetections: breedDetections,
            totalDistricts: districts.filter(Boolean).length,
            totalBreeds: breeds.filter(Boolean).length,
            speciesCounts: Object.fromEntries(speciesCounts.map(s => [s._id, s.count])),
            healthStats: Object.fromEntries(healthStats.map(s => [s._id, s.count])),
            recentAnimals,
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
