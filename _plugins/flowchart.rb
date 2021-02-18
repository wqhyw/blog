require 'securerandom'

class FlowchartBlock < Liquid::Block
    def render(context)
        text = super.to_s
        uuid = SecureRandom.uuid
        canvas = "canvas-#{uuid}"
        area = "area-#{uuid}"
        path = "#{context['site.url']}#{context['site.baseurl']}"
        <<~CB
        <div id="#{canvas}"></div>
        <textarea id="#{area}" style="display:none;">#{text}</textarea>
        <script>
            if (typeof($) === "undefined") {
                alert("include flowchart.html!");
            } else {
                $(function() {
                    let area = document.getElementById("#{area}");
                    let ctx = area.value;
                
                    chart = flowchart.parse(ctx);
                    chart.drawSVG("#{canvas}", {
                        'line-width': 2,
                        'maxWidth': 3,
                        'font-size': 11});
                    area.remove();
                });
            }
        </script>
        CB
    end
end

Liquid::Template.register_tag('flowchart', FlowchartBlock)