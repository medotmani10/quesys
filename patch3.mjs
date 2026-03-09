import fs from 'fs';

const filePath = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = `                  return activeTickets.map((t) => {
                    const lookup = barberLookup.get(t.barber_id || '');
                    const barber = lookup?.barber;
                    const barberIndex = lookup?.index ?? -1;
                    const code = getTicketCode(barberIndex, t.ticket_number);
                    return (
                      <div key={t.id} onClick={() => setSelectedTicketDetails(t)} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/50 transition-colors group cursor-pointer">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border',
                          t.status === 'serving'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-zinc-900 text-yellow-400 border-zinc-800',
                        )}>
                          {code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-sm leading-tight group-hover:text-yellow-400 transition-colors truncate">{t.customer_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {barber && (
                              <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                                <Scissors className="w-3 h-3" />{barber.name}
                              </span>
                            )}
                            {t.people_count > 1 && (
                              <span className="text-xs text-zinc-600">· {t.people_count} أشخاص</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            'text-xs font-black px-2.5 py-1 rounded-full border',
                            t.status === 'serving'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
                          )}>
                            {t.status === 'serving' ? 'يُخدم' : 'انتظار'}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); cancelTicket(t.id); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </TabsContent>`;

const replacementStr = `                  return activeTickets.map((t) => {
                    const lookup = barberLookup.get(t.barber_id || '');
                    const barber = lookup?.barber;
                    const barberIndex = lookup?.index ?? -1;
                    const code = getTicketCode(barberIndex, t.ticket_number);
                    return (
                      <div key={t.id} onClick={() => setSelectedTicketDetails(t)} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/50 transition-colors group cursor-pointer">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border',
                          t.status === 'serving'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-zinc-900 text-yellow-400 border-zinc-800',
                        )}>
                          {code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-sm leading-tight group-hover:text-yellow-400 transition-colors truncate">{t.customer_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {barber && (
                              <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                                <Scissors className="w-3 h-3" />{barber.name}
                              </span>
                            )}
                            {t.people_count > 1 && (
                              <span className="text-xs text-zinc-600">· {t.people_count} أشخاص</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            'text-xs font-black px-2.5 py-1 rounded-full border',
                            t.status === 'serving'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
                          )}>
                            {t.status === 'serving' ? 'يُخدم' : 'انتظار'}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); cancelTicket(t.id); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </TabsContent>`;

const newContent = content.replace(targetStr, replacementStr);
if (content === newContent) {
  console.log("No changes made!");
} else {
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log("Replaced successfully!");
}
