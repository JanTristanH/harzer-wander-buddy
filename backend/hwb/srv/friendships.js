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
    if (friendshipExists) {
        req.error(400, 'Friendship already exists');
        return;
    }
    return req;
}

const onAfterFriendshipCreate = async (req) => {
    const db = await cds.connect.to('db');
    // create pending PendingFriendshipRequests
    const { PendingFriendshipRequests } = db.entities;

    const pendingFriendshipRequest = {
        ID: uuidv4(),
        fromUser: { ID: req.toUser_ID },
        toUser: { ID: req.fromUser_ID },
        outgoingFriendship_ID: req.ID
    };
    await INSERT.into(PendingFriendshipRequests).entries(pendingFriendshipRequest);
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
        // fromUser_ID: req.user.id -> fromUser_ID is uuid, req.user.id is principal
      });
      
    if (!pendingRequest) {
      // Handle the case when the pending request is not found.
      req.error(404, 'Pending friendship request not found');
      return;
    }
  
    // Create the confirmed friendship using data from the pending request
    const friendship = {
      fromUser_ID: pendingRequest.fromUser_ID,
      toUser_ID: pendingRequest.toUser_ID,
      confirmed: true
    };
    await INSERT.into(Friendships).entries(friendship);
  
    // Delete the pending friendship request now that it has been accepted
    await DELETE.from(PendingFriendshipRequests).where({ ID: pendingRequest.ID });
  
    // Update the original friendship request to mark it as confirmed
    await UPDATE(Friendships)
      .set({ confirmed: true })
      .where({ ID: pendingRequest.outgoingFriendship_ID });
  
    return pendingRequest;
  };
  

module.exports = { onAfterFriendshipCreate, acceptPendingFriendshipRequest, onBeforeFriendshipCreate };