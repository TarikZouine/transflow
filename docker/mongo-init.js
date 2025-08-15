// Script d'initialisation MongoDB pour TransFlow
db = db.getSiblingDB('transflow');

// Créer un utilisateur pour l'application
db.createUser({
  user: 'transflow_user',
  pwd: 'transflow_password',
  roles: [
    {
      role: 'readWrite',
      db: 'transflow'
    }
  ]
});

// Créer les collections avec validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'name'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^.+@.+\..+$',
          description: 'Email must be a valid email address'
        },
        name: {
          bsonType: 'string',
          minLength: 2,
          description: 'Name must be a string with at least 2 characters'
        },
        role: {
          enum: ['admin', 'user'],
          description: 'Role must be either admin or user'
        }
      }
    }
  }
});

db.createCollection('callsessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'status'],
      properties: {
        title: {
          bsonType: 'string',
          minLength: 1,
          description: 'Title must be a non-empty string'
        },
        status: {
          enum: ['active', 'completed', 'paused', 'error'],
          description: 'Status must be one of the allowed values'
        },
        participants: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Participants must be an array of strings'
        }
      }
    }
  }
});

db.createCollection('transcriptionsegments', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['sessionId', 'text', 'confidence', 'startTime', 'endTime'],
      properties: {
        sessionId: {
          bsonType: 'objectId',
          description: 'SessionId must be a valid ObjectId'
        },
        text: {
          bsonType: 'string',
          minLength: 1,
          description: 'Text must be a non-empty string'
        },
        confidence: {
          bsonType: 'double',
          minimum: 0,
          maximum: 1,
          description: 'Confidence must be between 0 and 1'
        },
        startTime: {
          bsonType: 'number',
          minimum: 0,
          description: 'StartTime must be a positive number'
        },
        endTime: {
          bsonType: 'number',
          minimum: 0,
          description: 'EndTime must be a positive number'
        }
      }
    }
  }
});

// Créer les index pour optimiser les performances
db.users.createIndex({ email: 1 }, { unique: true });
db.callsessions.createIndex({ userId: 1, createdAt: -1 });
db.callsessions.createIndex({ status: 1 });
db.callsessions.createIndex({ startTime: -1 });
db.transcriptionsegments.createIndex({ sessionId: 1, startTime: 1 });
db.transcriptionsegments.createIndex({ text: 'text' });
db.transcriptionsegments.createIndex({ confidence: -1 });
db.transcriptionsegments.createIndex({ createdAt: -1 });

// Insérer des données de test (optionnel)
if (db.users.countDocuments() === 0) {
  db.users.insertOne({
    email: 'admin@transflow.com',
    name: 'Administrator',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  db.users.insertOne({
    email: 'user@transflow.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

print('TransFlow database initialized successfully!');
