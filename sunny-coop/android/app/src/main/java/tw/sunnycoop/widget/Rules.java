package tw.sunnycoop.widget;
public final class Rules {
 public static boolean high(double value,double limit,boolean enabled){return enabled&&Double.isFinite(value)&&value>=limit;}
 public static boolean low(double value,double limit,boolean enabled){return enabled&&Double.isFinite(value)&&value<=limit;}
 public static boolean direction(double degrees,double speed,int sector,double limit){return sector>=0&&Double.isFinite(degrees)&&Double.isFinite(speed)&&speed>=limit&&Math.abs(((degrees-sector+540)%360)-180)<=22.5;}
 public static String compass(double deg){if(!Double.isFinite(deg))return "—";return new String[]{"北","東北","東","東南","南","西南","西","西北"}[(int)Math.round(((deg%360)+360)%360/45)%8];}
}
