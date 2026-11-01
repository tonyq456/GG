package tw.sunnycoop.widget;
import android.app.PendingIntent;import android.app.job.*;import android.appwidget.*;import android.content.*;import android.graphics.Color;import android.os.Bundle;import android.widget.RemoteViews;import org.json.*;import java.text.SimpleDateFormat;import java.util.*;
public class CoopWidget extends AppWidgetProvider {
 static final int PERIODIC_JOB=4121,JOB=4120,WHITE=Color.WHITE,RED=0xffff8a80,GRAY=0xffaaaaaa;static final String REFRESH="tw.sunnycoop.widget.REFRESH";
 static SharedPreferences prefs(Context c){return c.getSharedPreferences("coop",Context.MODE_PRIVATE);}
 static void schedule(Context c){JobScheduler jobs=(JobScheduler)c.getSystemService(Context.JOB_SCHEDULER_SERVICE);if(jobs.getPendingJob(PERIODIC_JOB)==null)jobs.schedule(new JobInfo.Builder(PERIODIC_JOB,new ComponentName(c,WeatherJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(3600000L).setPersisted(true).build());jobs.schedule(new JobInfo.Builder(JOB,new ComponentName(c,WeatherJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).build());}
 public void onUpdate(Context c,AppWidgetManager m,int[] ids){render(c);schedule(c);}
 public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle b){render(c);}
 public void onReceive(Context c,Intent i){super.onReceive(c,i);if(REFRESH.equals(i.getAction())){schedule(c);}}
 static void render(Context c){renderProvider(c,CoopWidget.class,R.layout.coop_widget);renderProvider(c,CompactWidget.class,R.layout.coop_widget_compact);}
 static void renderProvider(Context c,Class<?> provider,int layout){boolean cloud=CloudSync.active(c);SharedPreferences p=cloud?CloudSync.prefs(c):prefs(c);JSONObject s;try{s=new JSONObject(p.getString("snapshot","{}"));}catch(Exception e){s=new JSONObject();}
 long fetched=p.getLong("fetched",0),source=s.optLong("source",0);boolean stale=fetched==0||System.currentTimeMillis()-fetched>5400000||System.currentTimeMillis()/1000-source>7200||!p.getString("error","").isEmpty();
 double t=s.optDouble("temp",Double.NaN),wind=s.optDouble("wind",Double.NaN),dir=s.optDouble("dir",Double.NaN),rain=s.optDouble("rain",Double.NaN);
 boolean ta=!stale&&(Rules.high(t,p.getFloat("high",32),p.getBoolean("highOn",false))||Rules.low(t,p.getFloat("low",15),p.getBoolean("lowOn",false))),wa=!stale&&(Rules.high(wind,p.getFloat("wind",10),p.getBoolean("windOn",false))||Rules.direction(dir,wind,p.getInt("sector",-1),p.getFloat("directionSpeed",8))),ra=!stale&&Rules.high(rain,p.getFloat("rain",70),p.getBoolean("rainOn",false));
 RemoteViews v=new RemoteViews(c.getPackageName(),layout);v.setTextViewText(R.id.site,p.getString("name","芳苑一場"));v.setTextViewText(R.id.temp,num(t)+"°C");v.setTextViewText(R.id.wind,Rules.compass(dir)+"風 "+num(dir)+"° · "+num(wind)+" m/s");v.setTextViewText(R.id.rain,"下小時降雨 "+num(rain)+"%");v.setTextColor(R.id.temp,stale?GRAY:ta?RED:WHITE);v.setTextColor(R.id.wind,stale?GRAY:wa?RED:WHITE);v.setTextColor(R.id.rain,stale?GRAY:ra?RED:WHITE);
 boolean enabled=p.getBoolean("highOn",false)||p.getBoolean("lowOn",false)||p.getBoolean("windOn",false)||p.getBoolean("rainOn",false)||p.getInt("sector",-1)>=0;boolean missing=!Double.isFinite(t)||!Double.isFinite(wind)||!Double.isFinite(rain);
 String status=stale?(fetched==0?"等待網路／請按更新":"資料過期或更新失敗"):(ta||wa||ra?"⚠ "+(ta?"溫度 ":"")+(wa?"強風／迎風 ":"")+(ra?"降雨機率":""):(missing?"部分資料缺失":enabled?"未達警戒 · 戶外估算":"警戒未啟用 · 戶外估算"));if(cloud){String error=p.getString("error","");if(!error.isEmpty())status=error;else status=(p.getLong("pauseUntil",0)>System.currentTimeMillis()?"提醒暫停 · ":"")+p.getString("cloudState","雲端")+" · "+status;}v.setTextViewText(R.id.status,status);v.setTextColor(R.id.status,stale?GRAY:ta||wa||ra?RED:GRAY);
 SimpleDateFormat fmt=new SimpleDateFormat("MM/dd HH:mm",Locale.TAIWAN);fmt.setTimeZone(TimeZone.getTimeZone("Asia/Taipei"));v.setTextViewText(R.id.updated,source>0?"資料 "+fmt.format(new Date(source*1000)):"尚未更新");
 Intent open=new Intent(c,SettingsActivity.class);PendingIntent settings=PendingIntent.getActivity(c,10,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);v.setOnClickPendingIntent(R.id.widget_root,settings);
 Intent refresh=new Intent(c,CoopWidget.class).setAction(REFRESH);v.setOnClickPendingIntent(R.id.refresh,PendingIntent.getBroadcast(c,11,refresh,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE));
 AppWidgetManager manager=AppWidgetManager.getInstance(c);int[] ids=manager.getAppWidgetIds(new ComponentName(c,provider));if(ids.length>0)manager.updateAppWidget(ids,v);
 }
 static String num(double n){return Double.isFinite(n)?String.format(Locale.US,"%.1f",n).replaceAll("\\.0$",""):"—";}
}
