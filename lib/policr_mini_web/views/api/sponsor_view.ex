defmodule PolicrMiniWeb.API.SponsorView do
  @moduledoc """
  渲染前台赞助者数据。
  """

  use PolicrMiniWeb, :view

  @spec render(String.t(), map()) :: map()
  def render("sponsor.json", %{sponsor: sponsor}) do
    sponsor |> Map.drop([:__meta__]) |> Map.from_struct()
  end
end
