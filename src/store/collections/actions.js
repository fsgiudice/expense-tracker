import firebase from 'firebase/app';
import 'firebase/database';

import { uid } from 'quasar';
import { firebaseAction } from 'vuexfire';
import { firebaseSetValue, firebaseUpdateValue, firebaseRemoveValue } from 'src/database/firebase';

export function addCollection(context, { collection, user }) {
  const collectionId = uid();
  const userId = user['.key'];

  firebaseSetValue(`collections/${collectionId}`, collection, { successMessage: 'Collection added!' });

  firebaseSetValue(`user_has_collections/${userId}/${collectionId}`, true);
  firebaseSetValue(`collection_has_users/${collectionId}/${userId}`, true);
}

export function updateCollection(context, payload) {
  firebaseUpdateValue(`collections/${payload.id}`, payload.updates, { successMessage: 'Collection updated!' });
}

export function deleteCollection(context, collectionId) {
  firebase.database().ref(`collection_has_users/${collectionId}`).once('value', (snapshot) => {
    Object.keys(snapshot.val()).forEach((userId) => {
      firebaseRemoveValue(`user_has_collections/${userId}/${collectionId}`);
      firebaseRemoveValue(`collection_has_users/${collectionId}/${userId}`);
    });

    firebaseRemoveValue(`collections/${collectionId}`, { successMessage: 'Collection deleted!' });
  });
}

// Load collections related to a user.
export const loadCollections = firebaseAction(
  ({
    bindFirebaseRef, unbindFirebaseRef, commit, dispatch, rootGetters,
  }, userId) => {
    const userHasCollections = firebase.database().ref(`user_has_collections/${userId}`);

    userHasCollections.once('value', (snapshot) => {
      const promises = [];

      Object.keys(snapshot.val()).forEach((collectionId) => {
        commit('initCollection', collectionId);
        promises.push(
          bindFirebaseRef(`collections.${collectionId}`, firebase.database().ref(`collections/${collectionId}`)),
        );
      });

      Promise.all(promises).then(() => {
        dispatch('app/setCollectionsLoaded', true, { root: true });
      });
    });

    userHasCollections.on('child_added', (snapshot) => {
      if (!rootGetters['app/collectionsLoaded']) {
        return;
      }

      commit('initCollection', snapshot.key);
      bindFirebaseRef(`collections.${snapshot.key}`, firebase.database().ref(`collections/${snapshot.key}`));
    });

    userHasCollections.on('child_removed', (snapshot) => {
      dispatch('collections/unbindCollection', snapshot.key, { root: true });

      unbindFirebaseRef(`collections.${snapshot.key}`);
      commit('deleteCollection', snapshot.key);
    });
  },
);
