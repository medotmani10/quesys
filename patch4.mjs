import fs from 'fs';

const filePath = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `          {/* ─── ALL TICKETS OVERVIEW tab ─── */}
          <TabsContent
            value="tickets_overview"
            className="mt-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <List className="w-5 h-5 text-yellow-400" />
                  جميع التذاكر النشطة
                </h3>
                <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-2.5 py-1 rounded-full">
                  {
                    tickets.filter(
                      (t) => t.status === "waiting" || t.status === "serving",
                    ).length
                  }
                </span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {tickets.filter(
                  (t) => t.status === "waiting" || t.status === "serving",
                ).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 opacity-30">
                    <Users className="w-12 h-12 text-zinc-600 mb-3" />
                    <p className="text-zinc-400 text-sm">لا توجد تذاكر نشطة</p>
                  </div>
                )}
                {(() => {
                  const activeTickets = tickets.filter(
                    (t) => t.status === "waiting" || t.status === "serving",
                  );
                  const barberLookup = new Map(
                    barbers.map((b, i) => [b.id, { barber: b, index: i }]),
                  );
                  return activeTickets.map((t) => {`;

const replacementStr = `          {/* ─── ALL TICKETS OVERVIEW tab ─── */}
          <TabsContent
            value="tickets_overview"
            className="mt-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            {(() => {
              const activeTickets = tickets.filter(
                (t) => t.status === "waiting" || t.status === "serving",
              );
              return (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="font-black text-white text-base flex items-center gap-2">
                      <List className="w-5 h-5 text-yellow-400" />
                      جميع التذاكر النشطة
                    </h3>
                    <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-2.5 py-1 rounded-full">
                      {activeTickets.length}
                    </span>
                  </div>
                  <div className="divide-y divide-zinc-800/60">
                    {activeTickets.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-14 opacity-30">
                        <Users className="w-12 h-12 text-zinc-600 mb-3" />
                        <p className="text-zinc-400 text-sm">لا توجد تذاكر نشطة</p>
                      </div>
                    )}
                    {(() => {
                      const barberLookup = new Map(
                        barbers.map((b, i) => [b.id, { barber: b, index: i }]),
                      );
                      return activeTickets.map((t) => {`;

const newContent = content.replace(targetStr, replacementStr);

const targetStr2 = `                  });
                })()}
              </div>
            </div>
          </TabsContent>`;
const replacementStr2 = `                  });
                    })()}
                  </div>
                </div>
              );
            })()}
          </TabsContent>`;
const newContent2 = newContent.replace(targetStr2, replacementStr2);

if (content === newContent2) {
  console.log("No changes made!");
} else {
  fs.writeFileSync(filePath, newContent2, 'utf8');
  console.log("Replaced successfully!");
}
