"""One-time setup only if creating a new empty FairMatch database directory."""
from pymongo import MongoClient
from pymongo.errors import OperationFailure
client = MongoClient('mongodb://127.0.0.1:27018/?directConnection=true', serverSelectionTimeoutMS=10000)
try:
    client.admin.command('replSetGetStatus')
    print('FairMatch replica set already initialized.')
except OperationFailure as error:
    if error.code != 94:
        raise
    client.admin.command('replSetInitiate', {'_id': 'fairmatch-rs', 'members': [{'_id': 0, 'host': '127.0.0.1:27018'}]})
    print('FairMatch replica set initialized.')
