const { QuestSchema } = require('./Quest');
const { dailyQuestSchema } = require('./DailyQuest');
const { userSettingsSchema } = require('./UserSettings');

const schemas = {
    Quest: QuestSchema,
    DailyQuest: dailyQuestSchema,
    UserSettings: userSettingsSchema
};

/**
 * Factory to get a connection-specific model.
 * This ensures that when we switch databases using useDb(), 
 * the models are correctly registered on the new connection.
 */
const getModel = (connection, modelName) => {
    if (!schemas[modelName]) {
        throw new Error(`Model ${modelName} not found in model factory.`);
    }

    // Check if the model is already compiled on this connection
    if (connection.models[modelName]) {
        return connection.models[modelName];
    }

    // Otherwise, compile it
    return connection.model(modelName, schemas[modelName]);
};

module.exports = { getModel };
