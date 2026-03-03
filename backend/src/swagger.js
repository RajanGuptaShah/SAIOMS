/**
 * SAIOMS — Swagger / OpenAPI Documentation
 * Served at /api/docs
 */
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'SAIOMS API',
            version: '2.0.0',
            description: 'Smart Animal Identification & Management System — REST API',
            contact: { name: 'SAIOMS Team' },
        },
        servers: [
            { url: 'http://localhost:5000', description: 'Local development' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication & user accounts' },
            { name: 'Users', description: 'Social profiles & follow system' },
            { name: 'Animals', description: 'Animal registration & management' },
            { name: 'Breed', description: 'AI breed detection' },
            { name: 'Nearby', description: 'Nearby vet & welfare services' },
            { name: 'Chat', description: 'Real-time messaging' },
        ],
    },
    apis: ['./src/routes/*.js'],
};

const spec = swaggerJsdoc(options);

function setupSwagger(app) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, {
        customSiteTitle: 'SAIOMS API Docs',
        customCss: '.swagger-ui .topbar { display: none }',
    }));
    app.get('/api/docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(spec);
    });
}

module.exports = { setupSwagger };
