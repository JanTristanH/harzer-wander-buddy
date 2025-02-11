const cds = require('@sap/cds/lib')
const {
  v4: uuidv4
} = require('uuid');

const onAfterFriendshipCreate = async (req) => {
    const db = await cds.connect.to('db');
    // create pending PendingFriendshipRequests
    const { PendingFriendshipRequests } = db.entities;

    const pendingFriendshipRequest = {
        ID: uuidv4(),
        fromUser: {ID : req.toUser_ID},
        toUser: {ID: req.fromUser_ID},
    };
    await INSERT.into(PendingFriendshipRequests).entries(pendingFriendshipRequest);
    return req;
}

const acceptPendingFriendshipRequest = async (req) => {
    // accept pending PendingFriendshipRequests
    // create Friendship and delete PendingFriendshipRequests
    // set both friendshipRequest.confirmed = true
    const db = await cds.connect.to('db');
    const { PendingFriendshipRequests, Friendships } = db.entities;
    const friendshipRequest = db.read(PendingFriendshipRequests)
        .where({ ID: req.data.ID, fromUser: req.user.principal }).first();
    const friendship = {
        fromUser: friendshipRequest.fromUser,
        toUser: friendshipRequest.toUser,
        confirmed: true
    };
    await db.create(Friendships).entries(friendship);
    await db.delete(PendingFriendshipRequests).where({ ID: friendshipRequest.ID });
    // set confirmed = true on original friendship request
    await db.update(FriendshipRequests).where({ ID: friendshipRequest.ID }).set({ confirmed: true });
    return friendshipRequest;
}

module.exports = {onAfterFriendshipCreate, acceptPendingFriendshipRequest};