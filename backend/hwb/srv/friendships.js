const cds = require('@sap/cds/lib')
const {
    v4: uuidv4
} = require('uuid');

const onBeforeFriendshipCreate = async (req) => {
    const db = await cds.connect.to('db');
    const { Friendships } = db.entities;
    // Check if the friendship already exists
    const friendshipExists = await SELECT.from(Friendships).where({
        fromUser_ID: req.data.fromUser_ID,
        toUser_ID: req.data.toUser_ID
    });
    if (friendshipExists.length > 0 || req.data.fromUser_ID == req.data.toUser_ID) {
        req.error(400, 'Friendship already exists');
        return;
    }
    return req;
}

const onAfterFriendshipCreate = async (req) => {
    const db = await cds.connect.to('db');
    // create pending PendingFriendshipRequests
    const { PendingFriendshipRequests, Friendships } = db.entities;

    await DELETE.from(PendingFriendshipRequests)
      .where(`fromUser.ID =`, req.fromUser_ID, `and toUser.ID =`, req.toUser_ID);


    // check if other person is already friend:
    const friendshipExists = await SELECT.from(Friendships)
    .where(`fromUser.ID =`, req.toUser_ID, `and toUser.ID =`, req.fromUser_ID);

    if (friendshipExists.length == 0) {
        const pendingFriendshipRequest = {
            ID: uuidv4(),
            fromUser: { ID: req.toUser_ID },
            toUser: { ID: req.fromUser_ID },
            outgoingFriendship_ID: req.ID
        };
        await INSERT.into(PendingFriendshipRequests).entries(pendingFriendshipRequest);
    }
    return req;
}

const acceptPendingFriendshipRequest = async (req) => {
    const db = await cds.connect.to('db');
    const { PendingFriendshipRequests, Friendships } = db.entities;
  
    // Retrieve the pending friendship request
    const pendingRequest = await SELECT.one
      .from(PendingFriendshipRequests)
      .where({ 
        ID: req.data.FriendshipID, 
        fromUser_ID: req.user.id
      });
      
    if (!pendingRequest) {
      // Handle the case when the pending request is not found.
      req.error(404, 'Pending friendship request not found');
      return;
    }
  
    // Create the confirmed friendship using data from the pending request
    const friendship = {
      fromUser_ID: pendingRequest.fromUser_ID,
      toUser_ID: pendingRequest.toUser_ID
    };
    await INSERT.into(Friendships).entries(friendship);
  
    // Delete the pending friendship request now that it has been accepted
    await DELETE.from(PendingFriendshipRequests).where({ ID: pendingRequest.ID });
  
    return pendingRequest;
  };
  

module.exports = { onAfterFriendshipCreate, acceptPendingFriendshipRequest, onBeforeFriendshipCreate };