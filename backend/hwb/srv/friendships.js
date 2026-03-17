const cds = require('@sap/cds/lib');
const { v4: uuidv4 } = require('uuid');

const FRIENDSHIP_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
};

const onBeforeFriendshipCreate = async (req) => {
  const db = await cds.connect.to('db');
  const { Friendships } = db.entities;

  req.data.fromUser_ID = req.data.fromUser_ID || req.user.id;
  req.data.status = req.data.status || FRIENDSHIP_STATUS.PENDING;

  if (!req.data.toUser_ID) {
    req.error(400, 'Target user is required');
    return;
  }

  if (req.data.fromUser_ID === req.data.toUser_ID) {
    req.error(400, 'Friendship already exists');
    return;
  }

  const [sameDirectionFriendship, reverseFriendship] = await Promise.all([
    SELECT.one.from(Friendships).where({
      fromUser_ID: req.data.fromUser_ID,
      toUser_ID: req.data.toUser_ID,
    }),
    SELECT.one.from(Friendships).where({
      fromUser_ID: req.data.toUser_ID,
      toUser_ID: req.data.fromUser_ID,
    }),
  ]);

  if (sameDirectionFriendship) {
    req.error(400, 'Friendship already exists');
    return;
  }

  if (reverseFriendship?.status === FRIENDSHIP_STATUS.ACCEPTED) {
    req.error(400, 'Friendship already exists');
    return;
  }

  if (reverseFriendship?.status === FRIENDSHIP_STATUS.PENDING) {
    req.error(409, 'Incoming friendship request already exists');
    return;
  }

  return req;
};

const onAfterFriendshipCreate = async (friendship) => {
  if (friendship.status !== FRIENDSHIP_STATUS.PENDING) {
    return friendship;
  }

  const db = await cds.connect.to('db');
  const { PendingFriendshipRequests } = db.entities;

  await DELETE.from(PendingFriendshipRequests).where({
    outgoingFriendship_ID: friendship.ID,
  });

  const pendingFriendshipRequest = {
    ID: uuidv4(),
    fromUser: { ID: friendship.toUser_ID },
    toUser: { ID: friendship.fromUser_ID },
    outgoingFriendship_ID: friendship.ID,
  };

  await INSERT.into(PendingFriendshipRequests).entries(pendingFriendshipRequest);

  return friendship;
};

const acceptPendingFriendshipRequest = async (req) => {
  const db = await cds.connect.to('db');
  const tx = db.tx(req);
  const { PendingFriendshipRequests, Friendships } = db.entities;

  const pendingRequest = await tx.run(
    SELECT.one.from(PendingFriendshipRequests).where({
      ID: req.data.FriendshipID,
      fromUser_ID: req.user.id,
    })
  );

  if (!pendingRequest) {
    req.error(404, 'Pending friendship request not found');
    return;
  }

  if (!pendingRequest.outgoingFriendship_ID) {
    req.error(500, 'Pending friendship request is missing its outgoing friendship');
    return;
  }

  await tx.run(
    UPDATE(Friendships)
      .set({ status: FRIENDSHIP_STATUS.ACCEPTED })
      .where({ ID: pendingRequest.outgoingFriendship_ID })
  );

  const reverseFriendship = await tx.run(
    SELECT.one.from(Friendships).where({
      fromUser_ID: pendingRequest.fromUser_ID,
      toUser_ID: pendingRequest.toUser_ID,
    })
  );

  if (reverseFriendship) {
    await tx.run(
      UPDATE(Friendships)
        .set({ status: FRIENDSHIP_STATUS.ACCEPTED })
        .where({ ID: reverseFriendship.ID })
    );
  } else {
    await tx.run(
      INSERT.into(Friendships).entries({
        fromUser_ID: pendingRequest.fromUser_ID,
        toUser_ID: pendingRequest.toUser_ID,
        status: FRIENDSHIP_STATUS.ACCEPTED,
      })
    );
  }

  await tx.run(DELETE.from(PendingFriendshipRequests).where({ ID: pendingRequest.ID }));

  return pendingRequest.outgoingFriendship_ID;
};

module.exports = {
  FRIENDSHIP_STATUS,
  onAfterFriendshipCreate,
  acceptPendingFriendshipRequest,
  onBeforeFriendshipCreate,
};
