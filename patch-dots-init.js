import fs from 'fs';
let content = fs.readFileSync('src/components/DotsAndBoxes.tsx', 'utf8');

const oldInit = `        if (snap.exists()) {
          const data = snap.data() as DotsAndBoxesState;

          if (
            data.status === "playing" &&
            data.updatedAt > (gameState?.updatedAt || 0)
          ) {
            playSound("receive");
          }
          if (
            data.status === "won" &&
            data.updatedAt > (gameState?.updatedAt || 0) &&
            data.winner
          ) {
            if (data.winner === currentUser.id) {
              playSound("success");
              toast.success("ניצחת בקווים וריבועים! 🎉", {
                duration: 4000,
                position: "top-center",
              });
            } else if (data.winner === partner.id) {
              playSound("error");
            }
          }

          setGameState(data);
        } else {
          initGame();
        }`;

const newInit = `        if (snap.exists()) {
          const data = snap.data() as DotsAndBoxesState;

          if (
            data.status === "playing" &&
            data.updatedAt > (gameState?.updatedAt || 0)
          ) {
            playSound("receive");
          }
          if (
            data.status === "won" &&
            data.updatedAt > (gameState?.updatedAt || 0) &&
            data.winner
          ) {
            if (data.winner === currentUser.id) {
              playSound("success");
              toast.success("ניצחת בקווים וריבועים! 🎉", {
                duration: 4000,
                position: "top-center",
              });
            } else if (data.winner === partner.id) {
              playSound("error");
            }
          }

          setGameState(data);
        } else if (!snap.metadata.fromCache) {
          // Only init if we are sure it doesn't exist on the server (not just missing from offline cache)
          initGame();
        }`;

content = content.replace(oldInit, newInit);
fs.writeFileSync('src/components/DotsAndBoxes.tsx', content);
console.log("Success patching DotsAndBoxes init");
